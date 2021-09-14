import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  DischargeDocumentsLinks,
  Member,
  MemberBase,
  MemberConfig,
  MemberService,
  MemberSummary,
  NotifyParams,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '.';
import {
  Errors,
  ErrorType,
  EventType,
  Identifier,
  IEventUpdateMemberPlatform,
  NotificationType,
  Platform,
  RegisterForNotificationParams,
} from '../common';
import { camelCase } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { getTimezoneOffset } from 'date-fns-tz';
import { millisecondsInHour } from 'date-fns';
import { lookup } from 'zipcode-to-timezone';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationsService, StorageService } from '../providers';
import { User, UserService } from '../user';

@Resolver(() => Member)
export class MemberResolver extends MemberBase {
  private readonly authenticationPrefix = 'Bearer ';

  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
    readonly userService: UserService,
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

  @Query(() => DischargeDocumentsLinks)
  async getMemberDischargeDocumentsLinks(@Args('id', { type: () => String }) id: string) {
    const member = await this.memberService.get(id);

    const { firstName, lastName } = member;

    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getUrl(`${firstName}_${lastName}_Summary.pdf`),
      await this.storageService.getUrl(`${firstName}_${lastName}_Instructions.pdf`),
    ]);

    return { dischargeNotesLink, dischargeInstructionsLink };
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
    await this.memberService.updateMemberConfig({
      memberId: memberConfig.memberId,
      platform: registerForNotificationParams.platform,
    });

    member.users.map((user) => {
      const eventParams: IEventUpdateMemberPlatform = {
        memberId: registerForNotificationParams.memberId,
        platform: registerForNotificationParams.platform,
        userId: user._id,
      };
      this.eventEmitter.emit(EventType.updateMemberPlatform, eventParams);
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  async notify(@Args(camelCase(NotifyParams.name)) notifyParams: NotifyParams) {
    const { memberId, userId, peerId, type } = notifyParams;
    const { member, memberConfig, user } = await this.extractDataOfMemberAndUser(memberId, userId);
    if (
      memberConfig.platform === Platform.web &&
      (type === NotificationType.call || type === NotificationType.video)
    ) {
      throw new Error(Errors.get(ErrorType.notificationMemberPlatformWeb));
    }

    if (
      notifyParams.metadata &&
      notifyParams.metadata[type] &&
      notifyParams.metadata[type].content
    ) {
      notifyParams.metadata[type].content = notifyParams.metadata[type].content
        .replace('@member.firstName@', member.firstName)
        .replace('@user.firstName@', user.firstName);
    }

    const path =
      type === NotificationType.call || type === NotificationType.video ? { path: 'call' } : {};

    await this.notificationsService.send({
      externalUserId: memberConfig.externalUserId,
      platform: memberConfig.platform,
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          avatar: user.avatar,
        },
        member: {
          phone: member.phone,
        },
        type,
        ...path,
        isVideo: type === NotificationType.video,
        peerId,
      },
      metadata: notifyParams.metadata ? notifyParams.metadata[type] : undefined,
    });
  }

  /**
   * Event is coming from appointment.scheduler - scheduling appointments reminders.
   * We have to specify an event method here, instead of just adding to @notify method,
   * since the app freezes when not catching the internal exception.
   */
  @OnEvent(EventType.notify, { async: true })
  async notifyInternal(notifyParams: NotifyParams) {
    try {
      await this.notify(notifyParams);
    } catch (ex) {
      console.error(ex);
    }
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  async getMemberConfig(@Args('id', { type: () => String }) id: string) {
    return this.memberService.getMemberConfig(id);
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private extractDeviceId(@Context() context) {
    const authorizationHeader = context.req?.headers.authorization.replace(
      this.authenticationPrefix,
      '',
    );

    const authorization = jwt.decode(authorizationHeader);

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
    const memberConfig = await this.memberService.getMemberConfig(memberId);
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return { member, memberConfig, user };
  }
}
