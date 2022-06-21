import {
  AppointmentStatus,
  ClientInfo,
  Identifier,
  MemberRole,
  RoleSummary,
  RoleTypes,
  User,
  UserRole,
  isLagunaUser,
} from '@argus/hepiusClient';
import {
  AlertInternalKey,
  ChatInternalKey,
  ContentKey,
  ExternalKey,
  IDeleteClientSettings,
  IDeleteDispatch,
  IUpdateClientSettings,
  IUpdateSenderClientId,
  InnerQueueTypes,
  InnerQueueTypes as IrisInnerQueueTypes,
  JournalCustomKey,
  LogInternalKey,
  NotifyCustomKey,
  RegisterInternalKey,
  generateDispatchId,
} from '@argus/irisClient';
import {
  ClientCategory,
  EntityName,
  GlobalEventType,
  IEventNotifySlack,
  NotificationType,
  Platform,
  QueueType,
  ServiceName,
  SlackChannel,
  SlackIcon,
  StorageType,
  formatEx,
} from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { isEmpty } from 'class-validator';
import { articlesPath, hosts } from 'config';
import { addDays, isAfter, millisecondsInHour } from 'date-fns';
import { getTimezoneOffset } from 'date-fns-tz';
import { camelCase } from 'lodash';
import { lookup } from 'zipcode-to-timezone';
import { AppointmentService } from '../appointment';
import {
  Ace,
  AceStrategy,
  Alert,
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventMember,
  IEventNotifyQueue,
  IEventOnAlertForQRSubmit,
  IEventOnPublishedJournal,
  IEventOnReceivedChatMessage,
  IEventOnReceivedTextMessage,
  IEventOnReplaceMemberOrg,
  IEventOnReplacedUserForMember,
  IEventOnUpdatedMemberPlatform,
  IInternalDispatch,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  RegisterForNotificationParams,
  Roles,
  generatePath,
  getCorrelationId,
} from '../common';
import { Communication, CommunicationService, GetCommunicationParams } from '../communication';
import { GraduateMemberParams, JourneyService } from '../journey';
import {
  Bitly,
  CognitoService,
  FeatureFlagService,
  OneSignal,
  StorageService,
  TwilioService,
} from '../providers';
import { QuestionnaireAlerts, QuestionnaireService, QuestionnaireType } from '../questionnaire';
import { TodoService } from '../todo';
import { UserService } from '../user';
import {
  AppointmentCompose,
  CancelNotifyParams,
  ChatMessageOrigin,
  CreateMemberParams,
  DeleteDischargeDocumentParams,
  DeleteMemberGeneralDocumentParams,
  DeleteMemberParams,
  DischargeDocumentsLinks,
  GetMemberUploadGeneralDocumentLinkParams,
  Member,
  MemberBase,
  MemberConfig,
  MemberService,
  MemberSummary,
  NotifyContentMetadata,
  NotifyContentParams,
  NotifyParams,
  ReplaceUserForMemberParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
} from './index';
import { OrgService } from '../org';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Member)
export class MemberResolver extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly cognitoService: CognitoService,
    private readonly oneSignal: OneSignal,
    readonly userService: UserService,
    readonly communicationService: CommunicationService,
    protected readonly bitly: Bitly,
    readonly featureFlagService: FeatureFlagService,
    readonly journeyService: JourneyService,
    readonly todoService: TodoService,
    readonly appointmentService: AppointmentService,
    readonly questionnaireService: QuestionnaireService,
    readonly orgService: OrgService,
    readonly twilio: TwilioService,
    readonly logger: LoggerService,
  ) {
    super(
      memberService,
      eventEmitter,
      userService,
      featureFlagService,
      journeyService,
      orgService,
      twilio,
      logger,
    );
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ): Promise<Member> {
    return super.createMember(createMemberParams);
  }

  @Query(() => Member, { nullable: true })
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `id` })
  async getMember(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ): Promise<Member> {
    const member = await this.memberService.get(id);
    const { org } = await this.journeyService.getRecent(member.id, true);
    member.zipCode = member.zipCode || org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Mutation(() => Member)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `id` })
  async updateMember(
    @Args(camelCase(UpdateMemberParams.name)) params: UpdateMemberParams,
  ): Promise<Member> {
    const objMobile = params.phoneSecondary
      ? { phoneSecondaryType: await this.twilio.getPhoneType(params.phoneSecondary) }
      : {};
    const member = await this.memberService.update({ ...params, ...objMobile });
    const { org } = await this.journeyService.getRecent(member.id, true);
    member.zipCode = member.zipCode || org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    this.notifyUpdatedMemberConfig({ member });
    return member;
  }

  @Query(() => [MemberSummary])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.byOrg, idLocator: 'orgIds' })
  async getMembers(
    @Args(
      'orgIds',
      { type: () => [String], nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.journeyOrgIdInvalid), { nullable: true }),
    )
    orgIds?: string[],
  ): Promise<MemberSummary[]> {
    return this.memberService.getByOrgs(orgIds);
  }

  @Query(() => [AppointmentCompose])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.byOrg, idLocator: 'orgIds' })
  async getMembersAppointments(
    @Args(
      'orgIds',
      { type: () => [String], nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.journeyOrgIdInvalid), { nullable: true }),
    )
    orgIds?: string[],
  ): Promise<AppointmentCompose[]> {
    return this.memberService.getMembersAppointments(orgIds);
  }

  /*************************************************************************************************
   ************************************ internal admin mutations ***********************************
   ************************************************************************************************/

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async deleteMember(
    @Client('_id') userId,
    @Args(camelCase(DeleteMemberParams.name))
    deleteMemberParams: DeleteMemberParams,
  ) {
    const { id, hard } = deleteMemberParams;
    const { member, memberConfig } = await this.memberService.deleteMember(
      deleteMemberParams,
      userId,
    );
    const eventParams: IEventDeleteMember = {
      memberId: id,
      deletedBy: userId,
      hard,
    };
    await this.deleteSchedules(eventParams);
    this.notifyDeletedMemberConfig(id, hard);
    this.eventEmitter.emit(EventType.onDeletedMember, eventParams);
    await this.deleteMemberFromServices(member, memberConfig, hard);
    return true;
  }

  private async deleteMemberFromServices(
    member: Member,
    memberConfig: MemberConfig,
    hard: boolean,
  ) {
    await this.oneSignal.unregister(memberConfig);
    if (member.deviceId) {
      await this.cognitoService.deleteClient(member.deviceId);
    }
    if (hard) {
      await this.storageService.deleteMember(member.id);
    }
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async replaceUserForMember(
    @Args(camelCase(ReplaceUserForMemberParams.name))
    replaceUserForMemberParams: ReplaceUserForMemberParams,
  ) {
    const newUser = await this.userService.get(replaceUserForMemberParams.userId);
    if (!newUser) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const member = await this.memberService.updatePrimaryUser(replaceUserForMemberParams);
    const { platform } = await this.memberService.getMemberConfig(member.id);
    const updateUserInCommunicationParams: IEventOnReplacedUserForMember = {
      newUser,
      oldUserId: member.primaryUserId.toString(),
      member,
      platform,
    };
    this.eventEmitter.emit(EventType.onReplacedUserForMember, updateUserInCommunicationParams);

    const updateSenderClientId: IUpdateSenderClientId = {
      type: IrisInnerQueueTypes.updateSenderClientId,
      recipientClientId: member.id,
      senderClientId: newUser.id,
      correlationId: getCorrelationId(this.logger),
    };
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(updateSenderClientId),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);

    return true;
  }

  @OnEvent(EventType.onReplaceMemberOrg, { async: true })
  protected async notifyUpdatedMemberOrg(params: IEventOnReplaceMemberOrg) {
    const member = await this.memberService.get(params.memberId);
    const settings: Partial<IUpdateClientSettings> = {
      type: InnerQueueTypes.updateClientSettings,
      clientCategory: ClientCategory.member,
      id: params.memberId,
      orgName: params.org.name,
      zipCode: member.zipCode || params.org.zipCode,
    };
    this.logger.info(settings, MemberBase.name, this.notifyUpdatedMemberOrg.name);
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }

  /*************************************************************************************************
   ************************************ DischargeDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => DischargeDocumentsLinks)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `id` })
  async getMemberUploadDischargeDocumentsLinks(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)))
    id?: string,
  ) {
    const member = await this.memberService.get(id);

    const { firstName, lastName } = member;

    const storageType = StorageType.documents;
    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getUploadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Summary.pdf`,
      }),
      await this.storageService.getUploadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Instructions.pdf`,
      }),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
  }

  @Query(() => DischargeDocumentsLinks)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `id` })
  async getMemberDownloadDischargeDocumentsLinks(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ) {
    const member = await this.memberService.get(id);
    const { firstName, lastName } = member;

    const storageType = StorageType.documents;
    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getDownloadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Summary.pdf`,
      }),
      await this.storageService.getDownloadUrl({
        storageType,
        memberId: id,
        id: `${firstName}_${lastName}_Instructions.pdf`,
      }),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async deleteDischargeDocument(
    @Args(camelCase(DeleteDischargeDocumentParams.name))
    deleteDischargeDocumentParams: DeleteDischargeDocumentParams,
  ) {
    const { memberId, dischargeDocumentType } = deleteDischargeDocumentParams;
    const { firstName, lastName } = await this.memberService.get(memberId);

    await this.storageService.moveToDeleted({
      storageType: StorageType.documents,
      memberId,
      id: `${firstName}_${lastName}_${dischargeDocumentType}.pdf`,
    });

    return true;
  }

  /*************************************************************************************************
   ************************************ GeneralDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => String)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberUploadGeneralDocumentLink(
    @Args(camelCase(GetMemberUploadGeneralDocumentLinkParams.name))
    getMemberUploadGeneralDocumentLinkParams: GetMemberUploadGeneralDocumentLinkParams,
  ) {
    const { memberId, fileName } = getMemberUploadGeneralDocumentLinkParams;

    // Validating member exists
    await this.memberService.get(memberId);

    if (
      await this.storageService.doesDocumentAlreadyExists({
        storageType: StorageType.general,
        memberId,
        id: fileName,
      })
    ) {
      throw new Error(Errors.get(ErrorType.memberUploadAlreadyExistingGeneralDocument));
    }

    return this.storageService.getUploadUrl({
      storageType: StorageType.general,
      memberId,
      id: fileName,
    });
  }

  @Query(() => [String])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberDownloadGeneralDocumentsLinks(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ) {
    // Validating member exists
    await this.memberService.get(memberId);

    const files = await this.storageService.getFolderFiles({
      storageType: StorageType.general,
      memberId,
    });

    return Promise.all(
      files.map(async (file) => {
        return this.storageService.getDownloadUrl({
          storageType: StorageType.general,
          memberId,
          id: file,
        });
      }),
    );
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async deleteMemberGeneralDocument(
    @Args(camelCase(DeleteMemberGeneralDocumentParams.name))
    deleteMemberGeneralDocumentParams: DeleteMemberGeneralDocumentParams,
  ) {
    const { memberId, fileName } = deleteMemberGeneralDocumentParams;

    // Validating member exists
    await this.memberService.get(memberId);

    return this.storageService.deleteFile({
      storageType: StorageType.general,
      memberId,
      id: fileName,
    });
  }

  /*************************************************************************************************
   ******************************************** Journal ********************************************
   ************************************************************************************************/

  @OnEvent(EventType.onPublishedJournal, { async: true })
  async handlePublishJournal(params: IEventOnPublishedJournal) {
    this.logger.info(params, MemberResolver.name, this.handlePublishJournal.name);

    const { memberId, text, journalImageDownloadLink, journalAudioDownloadLink } = params;

    const member = await this.memberService.get(memberId);
    const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
      memberId,
      userId: member.primaryUserId.toString(),
    });

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(
        JournalCustomKey.journalContent,
        memberId,
        Date.now().toString(),
      ),
      recipientClientId: member.primaryUserId.toString(),
      senderClientId: member.id,
      notificationType: NotificationType.chat,
      contentKey: JournalCustomKey.journalContent,
      sendBirdChannelUrl,
      content: text,
      journalImageDownloadLink,
      journalAudioDownloadLink,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  /*************************************************************************************************
   ********************************************* Alerts ********************************************
   ************************************************************************************************/
  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async dismissAlert(
    @Client('_id') userId: string,
    @Args('alertId', { type: () => String })
    alertId: string,
  ): Promise<boolean> {
    await this.memberService.dismissAlert(userId, alertId);
    return true;
  }

  @Query(() => [Alert])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async getAlerts(
    @Client('_id') userId: string,
    @Client('lastQueryAlert') lastQueryAlert: Date,
  ): Promise<Alert[]> {
    const members = await this.memberService.getUserMembers({ primaryUserId: userId });
    const memberAlerts = await this.memberService.getAlerts(userId, members, lastQueryAlert);
    const journeyAlerts = await this.journeyService.getAlerts(userId, members, lastQueryAlert);
    const todoAlerts = await this.todoService.getAlerts(userId, members, lastQueryAlert);
    const appointmentAlerts = await this.appointmentService.getAlerts(
      userId,
      members,
      lastQueryAlert,
    );
    const qAlerts = await this.questionnaireService.getAlerts(userId, members, lastQueryAlert);

    return memberAlerts.concat(journeyAlerts, todoAlerts, appointmentAlerts, qAlerts);
  }

  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(MemberRole.member)
  @Ace({ strategy: AceStrategy.token })
  async registerMemberForNotifications(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(RegisterForNotificationParams.name))
    registerForNotificationParams: RegisterForNotificationParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    // ignoring the id from the params - replacing it with the id from the context
    const member = await this.memberService.get(memberId);
    const currentMemberConfig = await this.memberService.getMemberConfig(memberId);
    const currentJourney = await this.journeyService.getRecent(memberId);

    if (registerForNotificationParams.platform === Platform.ios) {
      const { token } = registerForNotificationParams;
      await this.oneSignal.register({ token, externalUserId: currentMemberConfig.externalUserId });
    }

    const memberConfig = await this.memberService.updateMemberConfig({
      memberId: currentMemberConfig.memberId.toString(),
      platform: registerForNotificationParams.platform,
      isPushNotificationsEnabled: registerForNotificationParams.isPushNotificationsEnabled,
    });

    const eventParams: IEventOnUpdatedMemberPlatform = {
      memberId: member.id,
      platform: registerForNotificationParams.platform,
      userId: member.primaryUserId.toString(),
    };
    this.eventEmitter.emit(EventType.onUpdatedMemberPlatform, eventParams);

    const journey = await this.journeyService.updateLoggedInAt(currentMemberConfig.memberId);
    this.notifyUpdatedMemberConfig({ memberConfig, firstLoggedInAt: journey.firstLoggedInAt });

    if (!currentJourney.firstLoggedInAt) {
      const correlationId = getCorrelationId(this.logger);
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          RegisterInternalKey.newRegisteredMember,
          1,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          RegisterInternalKey.newRegisteredMemberNudge,
          2,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          journey.firstLoggedInAt,
          correlationId,
          LogInternalKey.logReminder,
          3,
        ),
      );
    }

    await this.notifyDeleteDispatch({
      dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, member.id),
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async notify(@Args(camelCase(NotifyParams.name)) notifyParams: NotifyParams) {
    const { memberId, userId, type, metadata } = notifyParams;
    const { member, memberConfig } = await this.extractDataOfMemberAndUser(memberId, userId);

    if (metadata.when && isAfter(new Date(), metadata.when)) {
      throw new Error(Errors.get(ErrorType.notificationMetadataWhenPast));
    }

    if (
      memberConfig.platform === Platform.web &&
      (type === NotificationType.call || type === NotificationType.video)
    ) {
      throw new Error(Errors.get(ErrorType.notificationMemberPlatformWeb));
    }

    if (
      !memberConfig.isPushNotificationsEnabled &&
      (type === NotificationType.call || type === NotificationType.video)
    ) {
      throw new Error(Errors.get(ErrorType.notificationNotAllowed));
    }

    if (metadata.content && isEmpty(metadata.content?.trim())) {
      throw new Error(Errors.get(ErrorType.notificationInvalidContent));
    }

    const contentKey =
      type === NotificationType.video || type === NotificationType.call
        ? NotifyCustomKey.callOrVideo
        : NotifyCustomKey.customContent;

    const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
      memberId: member.id,
      userId: member.primaryUserId.toString(),
    });

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, member.id, Date.now().toString()),
      notificationType: type,
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      contentKey,
      content: metadata.content,
      path: generatePath(type, contentKey),
      peerId: metadata.peerId,
      appointmentId: metadata.appointmentId,
      triggersAt: metadata.when,
      sendBirdChannelUrl,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async notifyContent(
    @Args(camelCase(NotifyContentParams.name))
    notifyContentParams: NotifyContentParams,
  ) {
    const { memberId, userId, contentKey, metadata } = notifyContentParams;
    const { member, memberConfig } = await this.extractDataOfMemberAndUser(memberId, userId);

    const { notificationType, baseParams } = this.extractNotificationTypeAndBaseParams({
      member,
      memberConfig,
      userId,
      contentKey,
      metadata,
    });

    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, member.id, Date.now().toString()),
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      notificationType,
      contentKey,
      ...baseParams,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async cancelNotify(
    @Args(camelCase(CancelNotifyParams.name))
    cancelNotifyParams: CancelNotifyParams,
  ) {
    const { memberId, type, metadata } = cancelNotifyParams;

    const contentKey = NotifyCustomKey.cancelNotify;
    const dispatch: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, memberId, Date.now().toString()),
      recipientClientId: memberId,
      notificationType: type,
      contentKey,
      peerId: metadata.peerId,
    };
    await this.notifyCreateDispatch(dispatch);
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async graduateMember(
    @Args(camelCase(GraduateMemberParams.name))
    graduateMemberParams: GraduateMemberParams,
  ) {
    const member = await this.memberService.get(graduateMemberParams.id);
    const journey = await this.journeyService.getRecent(graduateMemberParams.id);
    const memberConfig = await this.memberService.getMemberConfig(graduateMemberParams.id);
    if (journey.isGraduated !== graduateMemberParams.isGraduated) {
      if (memberConfig.platform !== Platform.web) {
        if (graduateMemberParams.isGraduated) {
          await this.cognitoService.disableClient(member.deviceId);
        } else {
          await this.cognitoService.enableClient(member.deviceId);
        }
      }
      await this.journeyService.graduate(graduateMemberParams);
    }
  }

  /**
   * Listening to chat message from sendbird webhook.
   * A message can be from a user or a member.
   * Determine origin (member or user) and decide if a notification should be sent
   */
  @OnEvent(EventType.onReceivedChatMessage, { async: true })
  async notifyChatMessage(params: IEventOnReceivedChatMessage) {
    this.logger.info(params, MemberResolver.name, this.notifyChatMessage.name);
    const { senderUserId, sendBirdChannelUrl } = params;

    let origin: ChatMessageOrigin;
    let member: Member;
    let communication: Communication;
    try {
      const user = await this.userService.get(senderUserId);
      if (!user) {
        member = await this.memberService.get(senderUserId);
        if (!member) {
          throw new Error(Errors.get(ErrorType.invalidSenderId));
        }
        origin = ChatMessageOrigin.fromMember;
      } else {
        origin = ChatMessageOrigin.fromUser;
        // getting communication in order to find the memberId
        communication = await this.communicationService.getByChannelUrlAndUser(
          sendBirdChannelUrl,
          user.id,
        );
        if (!communication) {
          throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
        }
      }

      if (origin === ChatMessageOrigin.fromUser) {
        const contentKey = ChatInternalKey.newChatMessageFromUser;
        const dispatch: IInternalDispatch = {
          correlationId: getCorrelationId(this.logger),
          dispatchId: generateDispatchId(contentKey, Date.now().toString()),
          recipientClientId: communication.memberId.toString(),
          senderClientId: senderUserId,
          notificationType: NotificationType.text,
          contentKey,
          path: generatePath(
            NotificationType.text,
            contentKey,
            communication.memberId.toString(),
            senderUserId,
          ),
        };
        await this.notifyCreateDispatch(dispatch);
      } else {
        // send text to the member's primary user
        const contentKey = ChatInternalKey.newChatMessageFromMember;
        const dispatch: IInternalDispatch = {
          correlationId: getCorrelationId(this.logger),
          dispatchId: generateDispatchId(contentKey, Date.now().toString()),
          recipientClientId: member.primaryUserId.toString(),
          senderClientId: senderUserId,
          notificationType: NotificationType.textSms,
          contentKey,
        };
        await this.notifyCreateDispatch(dispatch);
      }
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.notifyChatMessage.name, formatEx(ex));
    }
  }

  @OnEvent(EventType.notifyDispatch, { async: true })
  async notifyCreateDispatch(createDispatch: IInternalDispatch) {
    this.logger.info(createDispatch, MemberResolver.name, this.notifyCreateDispatch.name);

    const dispatch = {
      type: IrisInnerQueueTypes.createDispatch,
      serviceName: ServiceName.hepius,
      ...createDispatch,
    };

    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(dispatch, Object.keys(dispatch).sort()),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }

  @OnEvent(EventType.notifyDeleteDispatch, { async: true })
  async notifyDeleteDispatch(params: { dispatchId: string }) {
    this.logger.info(params, MemberResolver.name, this.notifyDeleteDispatch.name);
    const deleteDispatch: IDeleteDispatch = {
      type: IrisInnerQueueTypes.deleteDispatch,
      dispatchId: params.dispatchId,
      correlationId: getCorrelationId(this.logger),
    };
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(deleteDispatch),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }

  /**
   * Listening to incoming sms from twilio webhook.
   * Send message from member to chat.
   */
  @OnEvent(EventType.onReceivedTextMessage, { async: true })
  async sendSmsToChat(params: IEventOnReceivedTextMessage) {
    this.logger.info(params, MemberResolver.name, this.sendSmsToChat.name);
    try {
      const isControl = await this.memberService.isControlByPhone(params.phone);
      if (isControl) {
        return;
      }
      const member = await this.memberService.getByPhone(params.phone);
      const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });

      const dispatch: IInternalDispatch = {
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(
          NotifyCustomKey.customContent,
          member.primaryUserId.toString(),
          Date.now().toString(),
        ),
        notificationType: NotificationType.chat,
        recipientClientId: member.primaryUserId.toString(),
        senderClientId: member.id,
        sendBirdChannelUrl,
        contentKey: NotifyCustomKey.customContent,
        content: params.message,
      };
      return this.notifyCreateDispatch(dispatch);
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.sendSmsToChat.name, formatEx(ex));
    }
  }

  /**
   * Send an alert to the escalation slack channel on QR submit.
   */
  @OnEvent(EventType.onAlertForQRSubmit, { async: true })
  async handleAlertForQRSubmit(params: IEventOnAlertForQRSubmit) {
    this.logger.info(params, MemberResolver.name, this.handleAlertForQRSubmit.name);
    try {
      const member = await this.memberService.get(params.memberId);
      const { org } = await this.journeyService.getRecent(params.memberId, true);
      const primaryUser = member.users.find((user) => user.id === member.primaryUserId.toString());

      const notificationParams: IEventNotifySlack = {
        header: `*High Assessment Score [${org.name}]*`,
        message:
          `Alerting results on ` +
          `${params.questionnaireName} for ` +
          `${primaryUser.firstName} ${primaryUser.lastName}’s member - ` +
          `<${hosts.harmony}/details/${member.id}|${this.getMemberInitials(member)}>. ` +
          `Scored a '${params.score}'`,

        icon: SlackIcon.warning,
        channel: SlackChannel.escalation,
      };
      this.eventEmitter.emit(GlobalEventType.notifySlack, notificationParams);

      // if phq-9 alert raised we should notify the escalation team members in person (text message)
      if (
        params.questionnaireType === QuestionnaireType.phq9 &&
        params.score === QuestionnaireAlerts.get(QuestionnaireType.phq9)
      ) {
        (await this.userService.getEscalationGroupUsers()).map((user) => {
          const contentKey = AlertInternalKey.assessmentSubmitAlert;
          const phq9AlertEvent: IInternalDispatch = {
            correlationId: getCorrelationId(this.logger),
            dispatchId: generateDispatchId(contentKey, params.questionnaireResponseId),
            notificationType: NotificationType.textSms,
            recipientClientId: user.id,
            senderClientId: member.id,
            contentKey,
            assessmentName: params.questionnaireName,
            assessmentScore: params.score.toString(),
          };
          this.eventEmitter.emit(EventType.notifyDispatch, phq9AlertEvent);
        });
      }
    } catch (ex) {
      this.logger.error(
        params,
        MemberResolver.name,
        this.handleAlertForQRSubmit.name,
        formatEx(ex),
      );
    }
  }

  private async deleteSchedules(params: IEventMember) {
    try {
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(RegisterInternalKey.newMemberNudge, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(RegisterInternalKey.newRegisteredMember, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(
          RegisterInternalKey.newRegisteredMemberNudge,
          params.memberId,
        ),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(LogInternalKey.logReminder, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(NotifyCustomKey.customContent, params.memberId),
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.deleteSchedules.name, formatEx(ex));
    }
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  @MemberIdParam(MemberIdParamType.id)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `id` })
  async getMemberConfig(
    @Args(
      'id',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    id?: string,
  ) {
    const baseMemberConfig = await this.memberService.getMemberConfig(id);
    const { firstLoggedInAt, lastLoggedInAt } = await this.journeyService.getRecent(id);
    return { ...baseMemberConfig, firstLoggedInAt, lastLoggedInAt, articlesPath };
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  @Ace({ strategy: AceStrategy.token })
  async updateMemberConfig(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(UpdateMemberConfigParams.name))
    updateMemberConfigParams: UpdateMemberConfigParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    updateMemberConfigParams.memberId = memberId;
    const memberConfig = await this.memberService.updateMemberConfig(updateMemberConfigParams);
    this.notifyUpdatedMemberConfig({ memberConfig });
    return memberConfig !== null;
  }

  @Query(() => ClientInfo)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: [AceStrategy.byUser, AceStrategy.byMember], idLocator: 'id' })
  async getClient(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.clientIdInvalid)))
    id: string,
  ) {
    try {
      const client = (await this.userService.get(id)) || (await this.memberService.get(id));
      return {
        firstName: client.firstName,
        lastName: client.lastName,
        id: client.id,
        role: this.getRoleSummary(client.roles),
      } as ClientInfo;
    } catch (ex) {
      if (ex.message === Errors.get(ErrorType.memberNotFound)) {
        throw new Error(Errors.get(ErrorType.clientNotFound));
      }
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private static getTimezoneDeltaFromZipcode(zipCode?: string): number | undefined {
    if (zipCode) {
      const timeZone = lookup(zipCode);
      return getTimezoneOffset(timeZone) / millisecondsInHour;
    }
  }

  private getMemberInitials(member: Member): string {
    return member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase();
  }

  private getRoleSummary(roles: RoleTypes[]): string {
    if (isLagunaUser(roles as UserRole[])) return RoleSummary.laguna;
    if (roles.includes(MemberRole.member)) return RoleSummary.member;
    if (roles.includes(UserRole.coach)) return RoleSummary.coach;
  }

  private async extractDataOfMemberAndUser(
    memberId: string,
    userId: string,
  ): Promise<{ member: Member; memberConfig: MemberConfig; user: User }> {
    const member = await this.memberService.get(memberId);
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    const { org } = await this.journeyService.getRecent(memberId, true);
    member.zipCode = member.zipCode || org.zipCode;
    const memberConfig = await this.memberService.getMemberConfig(memberId);
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return { member, memberConfig, user };
  }

  private async getSendBirdChannelUrl(getCommunicationParams: GetCommunicationParams) {
    const communication = await this.communicationService.get(getCommunicationParams);
    if (!communication) {
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    } else {
      return communication.sendBirdChannelUrl;
    }
  }

  private notifyDeletedMemberConfig(id: string, hard: boolean) {
    const settings: IDeleteClientSettings = {
      type: IrisInnerQueueTypes.deleteClientSettings,
      id,
      hard,
    };

    const eventNotifyQueueParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventNotifyQueueParams);
  }

  private generateMobileRegistrationDispatch(
    member: Member,
    firstLoggedInAt: Date,
    correlationId: string,
    contentKey: ContentKey,
    amount: number,
  ): IInternalDispatch {
    return {
      correlationId,
      dispatchId: generateDispatchId(contentKey, member.id),
      recipientClientId: member.id,
      senderClientId: member.primaryUserId.toString(),
      notificationType: NotificationType.text,
      contentKey,
      triggersAt: addDays(firstLoggedInAt, amount),
    };
  }

  private extractNotificationTypeAndBaseParams({
    member,
    memberConfig,
    userId,
    contentKey,
    metadata,
  }: {
    member: Member;
    memberConfig: MemberConfig;
    userId: string;
    contentKey: ContentKey;
    metadata: NotifyContentMetadata;
  }): { notificationType: NotificationType; baseParams } {
    let notificationType;
    switch (contentKey) {
      case ExternalKey.setCallPermissions:
      case ExternalKey.addCaregiverDetails:
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForWebMember));
        }
        notificationType = NotificationType.text;
        return {
          notificationType,
          baseParams: {
            path: generatePath(notificationType, contentKey),
          },
        };
      case ExternalKey.answerQuestionnaire:
        const { questionnaireId } = metadata;
        if (memberConfig.platform === Platform.web || !memberConfig.isPushNotificationsEnabled) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForWebMember));
        }
        notificationType = NotificationType.text;
        return {
          notificationType,
          baseParams: {
            path: generatePath(notificationType, contentKey, questionnaireId),
          },
        };
      case ExternalKey.scheduleAppointment:
        if (memberConfig.platform !== Platform.web) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedForMobileMember));
        }
        const appointments = member.users
          .find((user) => user.id.toString() === userId.toString())
          ?.appointments.filter(
            (appointment) => appointment.status === AppointmentStatus.requested,
          );
        if (appointments.length === 0) {
          throw new Error(Errors.get(ErrorType.notificationNotAllowedNoRequestedAppointment));
        }
        notificationType = NotificationType.textSms;
        return {
          notificationType,
          baseParams: { scheduleLink: appointments[0].link },
        };
    }
  }
}
