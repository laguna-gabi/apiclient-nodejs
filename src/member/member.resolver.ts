import {
  ContentKey,
  ICreateDispatch,
  IDeleteClientSettings,
  IDeleteDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  Language,
  NotificationType,
  Platform,
  ServiceName,
  generateDispatchId,
} from '@lagunahealth/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { addDays, isAfter, millisecondsInHour } from 'date-fns';
import { format, getTimezoneOffset, utcToZonedTime } from 'date-fns-tz';
import { camelCase } from 'lodash';
import { v4 } from 'uuid';
import { lookup } from 'zipcode-to-timezone';
import {
  AddCaregiverParams,
  AppointmentCompose,
  AudioType,
  CancelNotifyParams,
  Caregiver,
  ChatMessageOrigin,
  CreateMemberParams,
  CreateTaskParams,
  DischargeDocumentsLinks,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  ImageType,
  Journal,
  JournalUploadAudioLink,
  JournalUploadImageLink,
  Member,
  MemberBase,
  MemberConfig,
  MemberService,
  MemberSummary,
  NotificationBuilder,
  NotifyParams,
  RecordingLinkParams,
  RecordingOutput,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  GetContentsParams,
  IDispatchParams,
  IEventMember,
  IEventNotifyQueue,
  IEventOnMemberBecameOffline,
  IEventOnReceivedChatMessage,
  IEventOnReceivedTextMessage,
  IEventOnReplacedUserForMember,
  IEventOnUpdatedMemberPlatform,
  Identifier,
  InternalNotifyParams,
  InternationalizationService,
  LoggerService,
  LoggingInterceptor,
  MemberRole,
  QueueType,
  RegisterForNotificationParams,
  Roles,
  StorageType,
  UserRole,
  getCorrelationId,
} from '../common';
import {
  CommunicationResolver,
  CommunicationService,
  GetCommunicationParams,
} from '../communication';
import {
  Bitly,
  CognitoService,
  FeatureFlagService,
  NotificationsService,
  StorageService,
} from '../providers';
import { User, UserService } from '../user';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Member)
export class MemberResolver extends MemberBase {
  private readonly scheduleAppointmentDateFormat = `EEEE LLLL do 'at' p`;

  constructor(
    readonly memberService: MemberService,
    private readonly notificationBuilder: NotificationBuilder,
    readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly cognitoService: CognitoService,
    private readonly notificationsService: NotificationsService,
    readonly userService: UserService,
    readonly communicationService: CommunicationService,
    private readonly communicationResolver: CommunicationResolver,
    readonly internationalizationService: InternationalizationService,
    protected readonly bitly: Bitly,
    readonly logger: LoggerService,
    readonly featureFlagService: FeatureFlagService,
  ) {
    super(memberService, eventEmitter, userService, featureFlagService, logger);
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ): Promise<Member> {
    return super.createMember(createMemberParams);
  }

  @Query(() => Member, { nullable: true })
  @Roles(MemberRole.member, UserRole.coach)
  async getMember(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ): Promise<Member> {
    memberId = roles.includes(MemberRole.member) ? memberId : id;
    const member = await this.memberService.get(memberId);
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Mutation(() => Member)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateMember(
    @Args(camelCase(UpdateMemberParams.name)) updateMemberParams: UpdateMemberParams,
  ): Promise<Member> {
    const member = await this.memberService.update(updateMemberParams);
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = MemberResolver.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Query(() => [MemberSummary])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMembers(
    @Args('orgId', { type: () => String, nullable: true }) orgId?: string,
  ): Promise<MemberSummary[]> {
    return this.memberService.getByOrg(orgId);
  }

  @Query(() => [AppointmentCompose])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMembersAppointments(
    @Args('orgId', { type: () => String, nullable: true }) orgId?: string,
  ): Promise<AppointmentCompose[]> {
    return this.memberService.getMembersAppointments(orgId);
  }

  /*************************************************************************************************
   ************************************ internal admin mutations ***********************************
   ************************************************************************************************/

  @Mutation(() => Boolean)
  @Roles(UserRole.admin)
  async archiveMember(@Args('id', { type: () => String }) id: string) {
    const { member, memberConfig } = await this.memberService.moveMemberToArchive(id);
    await this.communicationService.freezeGroupChannel({
      memberId: id,
      userId: member.primaryUserId.toString(),
    });
    await this.notificationsService.unregister(memberConfig);
    await this.cognitoService.disableMember(member.deviceId);

    this.notifyDeletedMemberConfig(member.id);
    await this.deleteSchedules({ memberId: id });
    return true;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.admin)
  async deleteMember(@Args('id', { type: () => String }) id: string) {
    const { member, memberConfig } = await this.memberService.deleteMember(id);
    const communication = await this.communicationService.getMemberUserCommunication({
      memberId: id,
      userId: member.primaryUserId.toString(),
    });
    if (!communication) {
      this.logger.warn(
        { memberId: id, userId: member.primaryUserId },
        MemberResolver.name,
        this.deleteMember.name,
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
    } else {
      await this.communicationService.deleteCommunication(communication);
    }
    await this.notificationsService.unregister(memberConfig);
    if (member.deviceId) {
      await this.cognitoService.deleteMember(member.deviceId);
    }
    await this.storageService.deleteMember(id);

    this.notifyDeletedMemberConfig(member.id);
    const eventParams: IEventMember = { memberId: id };
    await this.deleteSchedules(eventParams);
    this.eventEmitter.emit(EventType.onDeletedMember, eventParams);
    return true;
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.admin)
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
    return true;
  }

  /*************************************************************************************************
   ************************************ DischargeDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => DischargeDocumentsLinks)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberUploadDischargeDocumentsLinks(@Args('id', { type: () => String }) id: string) {
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
  @Roles(MemberRole.member, UserRole.coach)
  async getMemberDownloadDischargeDocumentsLinks(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    memberId = roles.includes(MemberRole.member) ? memberId : id;
    const member = await this.memberService.get(memberId);

    const { firstName, lastName } = member;

    const storageType = StorageType.documents;
    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getDownloadUrl({
        storageType,
        memberId,
        id: `${firstName}_${lastName}_Summary.pdf`,
      }),
      await this.storageService.getDownloadUrl({
        storageType,
        memberId,
        id: `${firstName}_${lastName}_Instructions.pdf`,
      }),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
  }

  /*************************************************************************************************
   ******************************************* Recording *******************************************
   ************************************************************************************************/

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberUploadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    // Validating member exists
    await this.memberService.get(recordingLinkParams.memberId);
    return this.storageService.getUploadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberDownloadRecordingLink(
    @Args(camelCase(RecordingLinkParams.name))
    recordingLinkParams: RecordingLinkParams,
  ) {
    // Validating member exists
    await this.memberService.get(recordingLinkParams.memberId);
    return this.storageService.getDownloadUrl({
      ...recordingLinkParams,
      storageType: StorageType.recordings,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateRecording(
    @Args(camelCase(UpdateRecordingParams.name)) updateRecordingParams: UpdateRecordingParams,
  ) {
    return this.memberService.updateRecording(updateRecordingParams);
  }

  @Query(() => [RecordingOutput])
  @Roles(UserRole.coach, UserRole.nurse)
  async getRecordings(@Args('memberId', { type: () => String }) memberId: string) {
    return this.memberService.getRecordings(memberId);
  }

  /*************************************************************************************************
   ********************************************* Goals *********************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createGoal(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertGoal({ createTaskParams, status: TaskStatus.pending });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateGoalStatus(
    @Args(camelCase(UpdateTaskStatusParams.name))
    updateTaskStatusParams: UpdateTaskStatusParams,
  ) {
    return this.memberService.updateGoalStatus(updateTaskStatusParams);
  }

  /*************************************************************************************************
   ****************************************** Action items *****************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createActionItem(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertActionItem({
      createTaskParams,
      status: TaskStatus.pending,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async updateActionItemStatus(
    @Args(camelCase(UpdateTaskStatusParams.name))
    updateTaskStatusParams: UpdateTaskStatusParams,
  ) {
    return this.memberService.updateActionItemStatus(updateTaskStatusParams);
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async setGeneralNotes(
    @Args(camelCase(SetGeneralNotesParams.name)) setGeneralNotesParams: SetGeneralNotesParams,
  ) {
    return this.memberService.setGeneralNotes(setGeneralNotesParams);
  }

  /*************************************************************************************************
   ******************************************** Journal ********************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(MemberRole.member)
  async createJournal(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    return this.memberService.createJournal(memberId);
  }

  @Mutation(() => Journal)
  @Roles(MemberRole.member)
  async updateJournalText(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(UpdateJournalTextParams.name)) updateJournalTextParams: UpdateJournalTextParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journal = await this.memberService.updateJournal({
      ...updateJournalTextParams,
      memberId,
      published: false,
    });

    return this.addMemberDownloadJournalLinks(journal);
  }

  @Query(() => Journal)
  @Roles(MemberRole.member)
  async getJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journal = await this.memberService.getJournal(id, memberId);

    return this.addMemberDownloadJournalLinks(journal);
  }

  @Query(() => [Journal])
  @Roles(MemberRole.member)
  async getJournals(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const journals = await this.memberService.getJournals(memberId);

    return Promise.all(
      journals.map(async (journal) => {
        return this.addMemberDownloadJournalLinks(journal);
      }),
    );
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat } = await this.memberService.deleteJournal(id, memberId);

    if (imageFormat) {
      return this.storageService.deleteJournalImages(id, memberId, imageFormat);
    }

    return true;
  }

  @Query(() => JournalUploadImageLink)
  @Roles(MemberRole.member)
  async getMemberUploadJournalImageLink(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(GetMemberUploadJournalImageLinkParams.name))
    getMemberUploadJournalImageLinkParams: GetMemberUploadJournalImageLinkParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id, imageFormat } = getMemberUploadJournalImageLinkParams;

    await this.memberService.updateJournal({ id, memberId, imageFormat, published: false });
    const normalImageLink = await this.storageService.getUploadUrl({
      storageType: StorageType.journals,
      memberId,
      id: `${id}${ImageType.NormalImage}.${imageFormat}`,
    });

    return { normalImageLink };
  }

  @Query(() => JournalUploadAudioLink)
  @Roles(MemberRole.member)
  async getMemberUploadJournalAudioLink(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(camelCase(GetMemberUploadJournalAudioLinkParams.name))
    getMemberUploadJournalAudioLinkParams: GetMemberUploadJournalAudioLinkParams,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { id, audioFormat } = getMemberUploadJournalAudioLinkParams;

    await this.memberService.updateJournal({ id, memberId, audioFormat, published: false });
    const audioLink = await this.storageService.getUploadUrl({
      storageType: StorageType.journals,
      memberId,
      id: `${id}${AudioType}.${audioFormat}`,
    });

    return { audioLink };
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournalImage(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat } = await this.memberService.getJournal(id, memberId);

    if (!imageFormat) {
      throw new Error(Errors.get(ErrorType.memberJournalImageNotFound));
    }

    await this.memberService.updateJournal({ id, memberId, imageFormat: null, published: false });
    return this.storageService.deleteJournalImages(id, memberId, imageFormat);
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteJournalAudio(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { audioFormat } = await this.memberService.getJournal(id, memberId);

    if (!audioFormat) {
      throw new Error(Errors.get(ErrorType.memberJournalAudioNotFound));
    }

    await this.memberService.updateJournal({ id, memberId, audioFormat: null, published: false });
    return this.storageService.deleteJournalAudio(id, memberId, audioFormat);
  }

  @Mutation(() => String)
  @Roles(MemberRole.member)
  async publishJournal(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String }) id: string,
  ) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const { imageFormat, text } = await this.memberService.updateJournal({
      id,
      memberId,
      published: true,
    });
    const member = await this.memberService.get(memberId);
    const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
      memberId,
      userId: member.primaryUserId.toString(),
    });

    let url;
    if (imageFormat) {
      url = await this.storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId,
        id: `${id}${ImageType.NormalImage}.${imageFormat}`,
      });
    }

    return this.internalNotify({
      memberId,
      userId: member.primaryUserId.toString(),
      type: InternalNotificationType.chatMessageJournal,
      content: text,
      metadata: {
        sendBirdChannelUrl,
        journalImageDownloadLink: url,
      },
    });
  }

  private async addMemberDownloadJournalLinks(journal: Journal) {
    const { id, memberId, imageFormat, audioFormat } = journal;
    let normalImageLink: string;
    let smallImageLink: string;
    let audioLink: string;

    if (imageFormat) {
      [normalImageLink, smallImageLink] = await Promise.all([
        this.storageService.getDownloadUrl({
          storageType: StorageType.journals,
          memberId: memberId.toString(),
          id: `${id}${ImageType.NormalImage}.${imageFormat}`,
        }),
        this.storageService.getDownloadUrl({
          storageType: StorageType.journals,
          memberId: memberId.toString(),
          id: `${id}${ImageType.SmallImage}.${imageFormat}`,
        }),
      ]);
    }
    if (audioFormat) {
      audioLink = await this.storageService.getDownloadUrl({
        storageType: StorageType.journals,
        memberId: memberId.toString(),
        id: `${id}${AudioType}.${audioFormat}`,
      });
    }
    journal.journalDownloadLinks = { normalImageLink, smallImageLink, audioLink };

    return journal;
  }

  /*************************************************************************************************
   ******************************************* Caregivers ******************************************
   ************************************************************************************************/

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member)
  async addCaregiver(
    @Client('_id') memberId,
    @Client('roles') roles,
    @Args(camelCase(AddCaregiverParams.name), { type: () => AddCaregiverParams })
    addCaregiverParams: AddCaregiverParams,
  ): Promise<Caregiver> {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }

    return this.memberService.addCaregiver(memberId, addCaregiverParams);
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
  async deleteCaregiver(
    @Client('_id') memberId,
    @Client('roles') roles,
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean | never> {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }

    // only allow a member to delete his own caregiver records
    const caregiver = await this.memberService.getCaregiver(id);
    if (caregiver && caregiver.memberId.toString() != memberId) {
      throw new Error(Errors.get(ErrorType.caregiverDeleteNotAllowed));
    }

    if (caregiver) {
      await this.memberService.deleteCaregiver(id);
    }

    return true;
  }

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member)
  async updateCaregiver(
    @Client('_id') memberId,
    @Client('roles') roles,
    @Args(camelCase(UpdateCaregiverParams.name), { type: () => UpdateCaregiverParams })
    updateCaregiverParams: UpdateCaregiverParams,
  ): Promise<Caregiver> {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }

    return await this.memberService.updateCaregiver(memberId, updateCaregiverParams);
  }

  @Query(() => [Caregiver])
  @Roles(MemberRole.member, UserRole.coach)
  async getCaregivers(
    @Client('_id') clientId,
    @Client('roles') roles,
    @Args('memberId', { type: () => String, nullable: true }) memberId?: string,
  ): Promise<Caregiver[]> {
    if (roles.includes(MemberRole.member)) {
      if (memberId && clientId != memberId) {
        throw new Error(Errors.get(ErrorType.memberIdInconsistent));
      }
      memberId = clientId;
    }
    return this.memberService.getCaregiversByMemberId(memberId);
  }
  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(MemberRole.member)
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

    if (registerForNotificationParams.platform === Platform.ios) {
      const { token } = registerForNotificationParams;
      await this.notificationsService.register({
        token,
        externalUserId: currentMemberConfig.externalUserId,
      });
    }

    if (!currentMemberConfig.firstLoggedInAt) {
      await this.memberService.updateMemberConfigRegisteredAt(currentMemberConfig.memberId);
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

    this.notifyUpdatedMemberConfig({ memberConfig });

    if (!currentMemberConfig.firstLoggedInAt) {
      const correlationId = getCorrelationId(this.logger);
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          memberConfig.firstLoggedInAt,
          correlationId,
          ContentKey.newRegisteredMember,
          1,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          memberConfig.firstLoggedInAt,
          correlationId,
          ContentKey.newRegisteredMemberNudge,
          2,
        ),
      );
      await this.notifyCreateDispatch(
        this.generateMobileRegistrationDispatch(
          member,
          memberConfig.firstLoggedInAt,
          correlationId,
          ContentKey.logReminder,
          3,
        ),
      );
    }

    await this.notifyDeleteDispatch({
      dispatchId: generateDispatchId(ContentKey.newMemberNudge, member.id),
    });
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async notify(@Args(camelCase(NotifyParams.name)) notifyParams: NotifyParams) {
    const { memberId, userId, type, metadata } = notifyParams;
    const { member, memberConfig, user } = await this.extractDataOfMemberAndUser(memberId, userId);

    if (metadata.when) {
      if (isAfter(new Date(), metadata.when)) {
        throw new Error(Errors.get(ErrorType.notificationMetadataWhenPast));
      }
      const dispatchParams: IDispatchParams = {
        memberId,
        userId,
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(ContentKey.customContent, memberId, Date.now().toString()),
        type:
          type === NotificationType.text
            ? InternalNotificationType.textToMember
            : InternalNotificationType.textSmsToMember,
        content: metadata.content,
        metadata: { contentType: ContentKey.customContent, triggersAt: metadata.when },
      };

      await this.notifyCreateDispatch(dispatchParams);
      return;
    }

    if (metadata.chatLink) {
      const communication = await this.communicationResolver.getCommunication({ memberId, userId });
      if (!communication) {
        throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
      }
      const chatLink = await this.bitly.shortenLink(communication.chat.memberLink);
      metadata.content = metadata.content.concat(` ${chatLink}`);
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

    if (metadata.content) {
      metadata.content = metadata.content.trim();
      if (!metadata.content) {
        // nothing remained after trim -> was only whitespaces
        throw new Error(Errors.get(ErrorType.notificationInvalidContent));
      }
    }

    if (type === NotificationType.textSms) {
      metadata.sendBirdChannelUrl = await this.getSendBirdChannelUrl({ memberId, userId });
    }

    return this.notificationBuilder.notify({ member, memberConfig, user, type, metadata });
  }

  @Mutation(() => String, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async cancelNotify(
    @Args(camelCase(CancelNotifyParams.name))
    cancelNotifyParams: CancelNotifyParams,
  ) {
    const { memberId, type, notificationId, metadata } = cancelNotifyParams;
    const memberConfig = await this.memberService.getMemberConfig(memberId);

    return this.notificationsService.cancel({
      platform: memberConfig.platform,
      externalUserId: memberConfig.externalUserId,
      data: {
        type,
        peerId: metadata.peerId,
        notificationId,
      },
    });
  }

  /**
   * Event is coming from appointment.scheduler
   */
  @OnEvent(EventType.notifyInternal, { async: true })
  async internalNotify(params: InternalNotifyParams) {
    this.logger.debug(params, MemberResolver.name, this.internalNotify.name);
    const { memberId, userId, type, metadata } = params;
    let content = params.content;

    try {
      const { member, memberConfig, user } = await this.extractDataOfMemberAndUser(
        memberId,
        userId,
      );

      if (
        metadata.checkAppointmentReminder &&
        memberConfig &&
        !memberConfig.isAppointmentsReminderEnabled
      ) {
        return;
      }

      if (metadata.appointmentTime) {
        if (InternalNotificationType.textSmsToMember || InternalNotificationType.textToMember) {
          metadata.extraData = {
            ...metadata.extraData,
            appointmentTime: format(
              utcToZonedTime(metadata.appointmentTime, lookup(member.zipCode)),
              `${this.scheduleAppointmentDateFormat} (z)`,
              { timeZone: lookup(member.zipCode) },
            ),
          };
        } else if (InternalNotificationType.textSmsToUser) {
          metadata.extraData = {
            ...metadata.extraData,
            appointmentTime: `${format(
              new Date(metadata.appointmentTime.toUTCString()),
              this.scheduleAppointmentDateFormat,
            )} (UTC)`,
          };
        }
      }

      if (metadata.contentType) {
        const getContentsParams: GetContentsParams = {
          contentType: metadata.contentType,
          member,
          user,
          extraData: metadata.extraData,
          language: type === InternalNotificationType.textSmsToUser ? Language.en : member.language,
        };
        content = this.internationalizationService.getContents(getContentsParams);
      }

      if ((metadata.scheduleLink || metadata.chatLink) && memberConfig.platform === Platform.web) {
        const getContentsParams: GetContentsParams = {
          contentType: metadata.chatLink
            ? ContentKey.appointmentReminderLink
            : ContentKey.appointmentRequestLink,
          member,
          user,
          extraData: metadata.chatLink
            ? { chatLink: metadata.chatLink }
            : { scheduleLink: metadata.scheduleLink },
          language: member.language,
        };
        content += this.internationalizationService.getContents(getContentsParams);
      }

      return await this.notificationBuilder.internalNotify({
        member,
        memberConfig,
        user,
        type,
        content,
        metadata,
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.internalNotify.name, ex);
    }
  }

  /**
   * Listening to chat message from sendbird webhook.
   * A message can be from a user or a member.
   * Determine origin (member or user) and decide if a notification should be sent
   */
  @OnEvent(EventType.onReceivedChatMessage, { async: true })
  async notifyChatMessage(params: IEventOnReceivedChatMessage) {
    const { senderUserId, sendBirdChannelUrl } = params;

    let origin: ChatMessageOrigin;
    let member: Member;
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
      }

      const communication = await this.communicationService.getByChannelUrl(sendBirdChannelUrl);

      if (!communication) {
        throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
      }

      if (origin === ChatMessageOrigin.fromUser) {
        await this.notifyCreateDispatch({
          dispatchId: generateDispatchId(ContentKey.newChatMessageFromUser, Date.now().toString()),
          memberId: communication.memberId.toString(),
          userId: senderUserId,
          type: InternalNotificationType.chatMessageToMember,
          correlationId: getCorrelationId(this.logger),
          metadata: {
            contentType: ContentKey.newChatMessageFromUser,
            path: `connect/${communication.memberId.toString()}/${senderUserId}`,
          },
        });
      } else {
        const coachInfo = params.sendBirdMemberInfo.find(
          (member) => member.memberId === communication.userId.toString(),
        );
        if (coachInfo && !coachInfo.isOnline) {
          await this.notifyCreateDispatch({
            dispatchId: generateDispatchId(
              ContentKey.newChatMessageFromMember,
              Date.now().toString(),
            ),
            memberId: senderUserId,
            userId: communication.userId.toString(),
            type: InternalNotificationType.textSmsToUser,
            correlationId: getCorrelationId(this.logger),
            metadata: { contentType: ContentKey.newChatMessageFromMember },
          });
        }
      }
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.notifyChatMessage.name, ex);
    }
  }

  @OnEvent(EventType.notifyDispatch, { async: true })
  async notifyCreateDispatch(params: IDispatchParams) {
    this.logger.debug(params, MemberResolver.name, this.notifyCreateDispatch.name);
    const { memberId, userId, type, metadata } = params;

    const createDispatch: ICreateDispatch = {
      type: InnerQueueTypes.createDispatch,
      dispatchId: params.dispatchId,
      correlationId: params.correlationId ? params.correlationId : v4(),
      serviceName: ServiceName.hepius,
      notificationType: type,
      recipientClientId: type !== InternalNotificationType.textSmsToUser ? memberId : userId,
      senderClientId: type !== InternalNotificationType.textSmsToUser ? userId : memberId,
      sendBirdChannelUrl: metadata.sendBirdChannelUrl,
      appointmentTime: metadata.appointmentTime,
      appointmentId: metadata.appointmentId,
      scheduleLink: metadata.scheduleLink,
      contentKey: metadata.contentType,
      triggersAt: metadata.triggersAt,
      path: metadata.path,
    };
    this.logger.debug(createDispatch, MemberResolver.name, EventType.notifyQueue);

    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(createDispatch, Object.keys(createDispatch).sort()),
    };
    this.eventEmitter.emit(EventType.notifyQueue, eventParams);
  }

  @OnEvent(EventType.notifyDeleteDispatch, { async: true })
  async notifyDeleteDispatch(params: { dispatchId: string }) {
    this.logger.debug(params, MemberResolver.name, this.notifyDeleteDispatch.name);
    const deleteDispatch: IDeleteDispatch = {
      type: InnerQueueTypes.deleteDispatch,
      dispatchId: params.dispatchId,
    };
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(deleteDispatch),
    };
    this.eventEmitter.emit(EventType.notifyQueue, eventParams);
  }

  /**
   * Listening to incoming sms from twilio webhook.
   * Send message from member to chat.
   */
  @OnEvent(EventType.onReceivedTextMessage, { async: true })
  async sendSmsToChat(params: IEventOnReceivedTextMessage) {
    try {
      const member = await this.memberService.getByPhone(params.phone);
      const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      });

      return await this.internalNotify({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: InternalNotificationType.chatMessageToUser,
        metadata: { sendBirdChannelUrl },
        content: params.message,
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.sendSmsToChat.name, ex);
    }
  }

  @OnEvent(EventType.onMemberBecameOffline, { async: true })
  async notifyOfflineMember(params: IEventOnMemberBecameOffline) {
    this.logger.debug(params, MemberResolver.name, this.notifyOfflineMember.name);
    const { phone, type } = params;
    const content = (params.content += `\n${config.get('hosts.dynamicLink')}`);
    try {
      if (type === NotificationType.text) {
        const member = await this.memberService.getByPhone(phone);
        return await this.internalNotify({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          type: InternalNotificationType.textSmsToMember,
          metadata: {},
          content,
        });
      }
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.notifyOfflineMember.name, ex);
    }
  }

  private async deleteSchedules(params: IEventMember) {
    try {
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(ContentKey.newMemberNudge, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(ContentKey.newRegisteredMember, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(ContentKey.newRegisteredMemberNudge, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(ContentKey.logReminder, params.memberId),
      });
      await this.notifyDeleteDispatch({
        dispatchId: generateDispatchId(ContentKey.customContent, params.memberId),
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.deleteSchedules.name, ex);
    }
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  @Roles(MemberRole.member, UserRole.coach)
  async getMemberConfig(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    memberId = roles.includes(MemberRole.member) ? memberId : id;
    return this.memberService.getMemberConfig(memberId);
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member)
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

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private static getTimezoneDeltaFromZipcode(zipCode?: string): number | undefined {
    if (zipCode) {
      const timeZone = lookup(zipCode);
      return getTimezoneOffset(timeZone) / millisecondsInHour;
    }
  }

  private async extractDataOfMemberAndUser(
    memberId: string,
    userId: string,
  ): Promise<{ member: Member; memberConfig: MemberConfig; user: User }> {
    const member = await this.memberService.get(memberId);
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    member.zipCode = member.zipCode || member.org.zipCode;
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

  private notifyDeletedMemberConfig(id: string) {
    const settings: IDeleteClientSettings = { type: InnerQueueTypes.deleteClientSettings, id };

    const eventNotifyQueueParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(EventType.notifyQueue, eventNotifyQueueParams);
  }

  private generateMobileRegistrationDispatch(
    member: Member,
    firstLoggedInAt: Date,
    correlationId: string,
    contentKey: ContentKey,
    amount: number,
  ): IDispatchParams {
    return {
      memberId: member.id,
      userId: member.primaryUserId.toString(),
      type: InternalNotificationType.textToMember,
      correlationId,
      dispatchId: generateDispatchId(contentKey, member.id),
      metadata: {
        contentType: contentKey,
        triggersAt: addDays(firstLoggedInAt, amount),
      },
    };
  }
}
