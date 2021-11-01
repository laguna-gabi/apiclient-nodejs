import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { millisecondsInHour } from 'date-fns';
import { format, getTimezoneOffset, utcToZonedTime } from 'date-fns-tz';
import { camelCase } from 'lodash';
import { lookup } from 'zipcode-to-timezone';
import {
  AppointmentCompose,
  CancelNotifyParams,
  CreateMemberParams,
  CreateTaskParams,
  DischargeDocumentsLinks,
  Member,
  MemberBase,
  MemberConfig,
  MemberScheduler,
  MemberService,
  MemberSummary,
  NotificationBuilder,
  NotifyParams,
  RecordingLinkParams,
  RecordingOutput,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IEventDeleteSchedules,
  IEventNotifyChatMessage,
  IEventSendSmsToChat,
  IEventUpdateMemberPlatform,
  Identifier,
  InternalNotificationType,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
  NotificationType,
  Platform,
  RegisterForNotificationParams,
  RoleTypes,
  Roles,
  StorageType,
  extractAuthorizationHeader,
} from '../common';
import {
  CommunicationResolver,
  CommunicationService,
  GetCommunicationParams,
} from '../communication';
import { Bitly, CognitoService, NotificationsService, StorageService } from '../providers';
import { User, UserService } from '../user';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Member)
export class MemberResolver extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    private readonly memberScheduler: MemberScheduler,
    private readonly notificationBuilder: NotificationBuilder,
    readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly cognitoService: CognitoService,
    private readonly notificationsService: NotificationsService,
    readonly userService: UserService,
    readonly communicationService: CommunicationService,
    private readonly communicationResolver: CommunicationResolver,
    protected readonly bitly: Bitly,
    readonly logger: Logger,
  ) {
    super(memberService, eventEmitter, userService);
  }

  @Mutation(() => Identifier)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    return super.createMember(createMemberParams);
  }

  /**
   * Can be called from 2 sources:
   * @param context : mobile - by using authorization header in context
   * @param id : web - by using a query param of member id
   */
  @Query(() => Member, { nullable: true })
  @Roles(RoleTypes.Member, RoleTypes.User)
  async getMember(
    @Context() context,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    let member;
    if (id) {
      member = await this.memberService.get(id);
    } else {
      const deviceId = this.extractDeviceId(context);
      member = await this.memberService.getByDeviceId(deviceId);
    }
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = this.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Mutation(() => Member)
  async updateMember(
    @Args(camelCase(UpdateMemberParams.name)) updateMemberParams: UpdateMemberParams,
  ) {
    const member = await this.memberService.update(updateMemberParams);
    member.zipCode = member.zipCode || member.org.zipCode;
    member.utcDelta = this.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Query(() => [MemberSummary])
  async getMembers(@Args('orgId', { type: () => String, nullable: true }) orgId?: string) {
    return this.memberService.getByOrg(orgId);
  }

  @Query(() => [AppointmentCompose])
  async getMembersAppointments(
    @Args('orgId', { type: () => String, nullable: true }) orgId?: string,
  ) {
    return this.memberService.getMembersAppointments(orgId);
  }

  /*************************************************************************************************
   ************************************ internal admin mutations ***********************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  async archiveMember(@Args('id', { type: () => String }) id: string) {
    const { member, memberConfig } = await this.memberService.moveMemberToArchive(id);
    await this.communicationService.freezeGroupChannel({
      memberId: id,
      userId: member.primaryUserId,
    });
    await this.notificationsService.unregister(memberConfig);
    await this.cognitoService.disableMember(member.deviceId);

    const params: IEventDeleteSchedules = { memberId: id };
    this.eventEmitter.emit(EventType.deleteSchedules, params);
  }

  @Mutation(() => Boolean, { nullable: true })
  async deleteMember(@Args('id', { type: () => String }) id: string) {
    const { member, memberConfig } = await this.memberService.deleteMember(id);
    const communication = await this.communicationService.getMemberUserCommunication({
      memberId: id,
      userId: member.primaryUserId,
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
    await this.cognitoService.deleteMember(member.deviceId);
    await this.storageService.deleteMember(id);
    this.eventEmitter.emit(EventType.deleteMember, id);
    const params: IEventDeleteSchedules = { memberId: id };
    this.eventEmitter.emit(EventType.deleteSchedules, params);
  }

  /*************************************************************************************************
   ************************************ DischargeDocumentsLinks ************************************
   ************************************************************************************************/

  @Query(() => DischargeDocumentsLinks)
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
  @Roles(RoleTypes.Member, RoleTypes.User)
  async getMemberDownloadDischargeDocumentsLinks(@Args('id', { type: () => String }) id: string) {
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

  /*************************************************************************************************
   ******************************************* Recording *******************************************
   ************************************************************************************************/

  @Query(() => String)
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
  async updateRecording(
    @Args(camelCase(UpdateRecordingParams.name)) updateRecordingParams: UpdateRecordingParams,
  ) {
    return this.memberService.updateRecording(updateRecordingParams);
  }

  @Query(() => [RecordingOutput])
  async getRecordings(@Args('memberId', { type: () => String }) memberId: string) {
    return this.memberService.getRecordings(memberId);
  }

  /*************************************************************************************************
   ********************************************* Goals *********************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  async createGoal(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertGoal({ createTaskParams, status: TaskStatus.pending });
  }

  @Mutation(() => Boolean, { nullable: true })
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
  async setGeneralNotes(
    @Args(camelCase(SetGeneralNotesParams.name)) setGeneralNotesParams: SetGeneralNotesParams,
  ) {
    return this.memberService.setGeneralNotes(setGeneralNotesParams);
  }

  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/

  @Mutation(() => Boolean, { nullable: true })
  @Roles(RoleTypes.Member, RoleTypes.User)
  async registerMemberForNotifications(
    @Args(camelCase(RegisterForNotificationParams.name))
    registerForNotificationParams: RegisterForNotificationParams,
  ) {
    const member = await this.memberService.get(registerForNotificationParams.memberId);
    const memberConfig = await this.memberService.getMemberConfig(
      registerForNotificationParams.memberId,
    );

    if (registerForNotificationParams.platform === Platform.ios) {
      const { token } = registerForNotificationParams;
      await this.notificationsService.register({
        token,
        externalUserId: memberConfig.externalUserId,
      });
    }
    if (!memberConfig.firstLoggedInAt) {
      await this.memberService.updateMemberConfigRegisteredAt(memberConfig.memberId);
    }
    await this.memberService.updateMemberConfig({
      memberId: memberConfig.memberId,
      platform: registerForNotificationParams.platform,
      isPushNotificationsEnabled: registerForNotificationParams.isPushNotificationsEnabled,
    });

    member.users.map((user) => {
      const eventParams: IEventUpdateMemberPlatform = {
        memberId: registerForNotificationParams.memberId,
        platform: registerForNotificationParams.platform,
        userId: user._id,
      };
      this.eventEmitter.emit(EventType.updateMemberPlatform, eventParams);
    });

    this.memberScheduler.deleteTimeout({ id: member.id });

    await this.memberScheduler.registerNewRegisteredMemberNotify({
      memberId: member.id,
      userId: member.primaryUserId,
      firstLoggedInAt: new Date(),
    });
  }

  @Mutation(() => String, { nullable: true })
  async notify(@Args(camelCase(NotifyParams.name)) notifyParams: NotifyParams) {
    const { memberId, userId, type, metadata } = notifyParams;
    const { member, memberConfig, user } = await this.extractDataOfMemberAndUser(memberId, userId);

    if (metadata.when) {
      await this.memberScheduler.registerCustomFutureNotify(notifyParams);
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

    if (metadata.content) {
      metadata.content = this.replaceConfigs({ content: metadata.content, member, user });
    }

    if (type === NotificationType.textSms) {
      metadata.sendBirdChannelUrl = await this.getSendBirdChannelUrl({ memberId, userId });
    }

    return this.notificationBuilder.notify({ member, memberConfig, user, type, metadata });
  }

  @Mutation(() => String, { nullable: true })
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
   * Event is coming from appointment.scheduler or
   * member.scheduler - scheduling reminders and nudges.
   */
  @OnEvent(EventType.internalNotify, { async: true })
  async internalNotify(params: InternalNotifyParams) {
    const { memberId, userId, type, metadata } = params;
    let member: Member;
    let memberConfig: MemberConfig;
    let user: User;

    try {
      if (type === InternalNotificationType.textSmsToUser) {
        user = await this.userService.get(userId);
        if (!user) {
          throw new Error(Errors.get(ErrorType.userNotFound));
        }
        metadata.content = metadata.content.replace('@user.firstName@', user.firstName);
      } else {
        ({ member, memberConfig, user } = await this.extractDataOfMemberAndUser(memberId, userId));
        metadata.content = this.replaceConfigs({
          content: metadata.content,
          member,
          user,
        });
      }
      if (metadata.appointmentTime) {
        metadata.content = metadata.content.replace(
          '@appointment.time@',
          format(
            utcToZonedTime(metadata.appointmentTime, lookup(member.zipCode)),
            "EEEE LLLL do 'at' p (z)",
            { timeZone: lookup(member.zipCode) },
          ),
        );
      }
      return await this.notificationBuilder.internalNotify({
        member,
        memberConfig,
        user,
        type,
        metadata,
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.internalNotify.name, ex);
    }
  }

  /**
   * Listening to chat message from sendbird webhook.
   * A message can be from a user or a member, we'll need to check first if the sender is the user.
   */
  @OnEvent(EventType.notifyChatMessage, { async: true })
  async notifyChatMessage(params: IEventNotifyChatMessage) {
    const { senderUserId, sendBirdChannelUrl } = params;

    try {
      const user = await this.userService.get(senderUserId);
      if (!user) {
        throw new Error(Errors.get(ErrorType.userNotFound));
      }

      const communication = await this.communicationService.getByChannelUrl(sendBirdChannelUrl);
      if (!communication) {
        throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
      }

      return await this.internalNotify({
        memberId: communication.memberId.toString(),
        userId: senderUserId,
        type: InternalNotificationType.chatMessageToMember,
        metadata: { content: config.get('contents.newChatMessage') },
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.notifyChatMessage.name, ex);
    }
  }

  /**
   * Listening to incoming sms from twilio webhook.
   * Send message from member to chat.
   */
  @OnEvent(EventType.sendSmsToChat, { async: true })
  async sendSmsToChat(params: IEventSendSmsToChat) {
    try {
      const member = await this.memberService.getByPhone(params.phone);
      const sendBirdChannelUrl = await this.getSendBirdChannelUrl({
        memberId: member.id,
        userId: member.primaryUserId,
      });

      return await this.internalNotify({
        memberId: member.id,
        userId: member.primaryUserId,
        type: InternalNotificationType.chatMessageToUser,
        metadata: { content: params.message, sendBirdChannelUrl },
      });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.sendSmsToChat.name, ex);
    }
  }

  @OnEvent(EventType.deleteSchedules, { async: true })
  async deleteSchedules(params: IEventDeleteSchedules) {
    const { memberId } = params;
    try {
      const notifications = await this.memberService.getMemberNotifications(memberId);
      notifications.forEach((notification) => {
        this.memberScheduler.deleteTimeout({ id: notification._id });
      });
      this.memberScheduler.deleteTimeout({ id: memberId });
    } catch (ex) {
      this.logger.error(params, MemberResolver.name, this.deleteSchedules.name, ex);
    }
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  @Roles(RoleTypes.Member, RoleTypes.User)
  async getMemberConfig(@Args('id', { type: () => String }) id: string) {
    return this.memberService.getMemberConfig(id);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private extractDeviceId(@Context() context) {
    const authorization = extractAuthorizationHeader(context);

    if (!authorization?.username) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return authorization.username;
  }

  private getTimezoneDeltaFromZipcode(zipCode?: string): number | undefined {
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

  private replaceConfigs(params: { content: string; member: Member; user: User }): string {
    const { content, member, user } = params;
    return content
      .replace('@member.honorific@', config.get(`contents.honorific.${member.honorific}`))
      .replace('@member.lastName@', this.capitalize(member.lastName))
      .replace('@user.firstName@', this.capitalize(user.firstName));
  }

  private capitalize(content: string): string {
    return content[0].toUpperCase() + content.slice(1);
  }

  private async getSendBirdChannelUrl(getCommunicationParams: GetCommunicationParams) {
    const communication = await this.communicationService.get(getCommunicationParams);
    if (!communication) {
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    } else {
      return communication.sendBirdChannelUrl;
    }
  }
}
