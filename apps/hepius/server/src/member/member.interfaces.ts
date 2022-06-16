import {
  IUpdateClientSettings,
  InnerQueueTypes,
  RegisterInternalKey,
  generateDispatchId,
} from '@argus/irisClient';
import {
  ClientCategory,
  GlobalEventType,
  IEventNotifySlack,
  NotificationType,
  QueueType,
  SlackChannel,
  SlackIcon,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isUndefined, omitBy } from 'lodash';
import { Types } from 'mongoose';
import {
  CreateMemberParams,
  InternalCreateMemberParams,
  Member,
  MemberConfig,
  MemberService,
} from '.';
import {
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewMember,
  IInternalDispatch,
  LoggerService,
  getCorrelationId,
} from '../common';
import { FeatureFlagService, TwilioService } from '../providers';
import { UserService } from '../user';
import { JourneyService } from '../journey';
import { Org, OrgService } from '../org';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly journeyService: JourneyService,
    readonly orgService: OrgService,
    readonly twilio: TwilioService,
    readonly logger: LoggerService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams): Promise<Member> {
    const { userId, orgId, phone } = createMemberParams;
    const phoneType = await this.twilio.getPhoneType(phone);
    const control = !userId && (await this.featureFlagService.isControlGroup(orgId));
    if (control) {
      return this.createControlMember({ ...createMemberParams, phoneType });
    } else {
      return this.createRealMember({ ...createMemberParams, phoneType });
    }
  }

  async createRealMember(params: InternalCreateMemberParams): Promise<Member> {
    this.logger.info(params, MemberBase.name, this.createRealMember.name);

    const org = await this.orgService.get(params.orgId);
    if (!org) {
      throw new Error(Errors.get(ErrorType.orgIdNotFound));
    }

    const primaryUserId = params.userId
      ? new Types.ObjectId(params.userId)
      : await this.userService.getAvailableUser(params.orgId);

    const user = await this.userService.get(primaryUserId.toString());

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const { orgId, ...otherParams } = params;
    const { id } = await this.memberService.insert(otherParams, primaryUserId);
    await this.journeyService.create({ memberId: id, orgId });

    const memberConfig = await this.memberService.getMemberConfig(id);
    const member = await this.memberService.get(id);
    this.notifyUpdatedMemberConfig({ member, memberConfig, org });

    const eventNewMemberParams: IEventOnNewMember = {
      member,
      user,
      platform: memberConfig.platform,
    };
    this.eventEmitter.emit(EventType.onNewMember, eventNewMemberParams);

    const eventSlackMessageParams: IEventNotifySlack = {
      header: `*New _real_ member*`,
      message: `${member.firstName} [${member.id}]\nAssigned to ${user.firstName}`,
      icon: SlackIcon.info,
      channel: SlackChannel.support,
      orgName: org.name,
    };
    this.eventEmitter.emit(GlobalEventType.notifySlack, eventSlackMessageParams);

    return member;
  }

  async createControlMember(params: InternalCreateMemberParams): Promise<Member> {
    this.logger.info(params, MemberBase.name, this.createControlMember.name);
    const org = await this.orgService.get(params.orgId);
    if (!org) {
      throw new Error(Errors.get(ErrorType.orgIdNotFound));
    }

    const { orgId, ...otherParams } = params;
    const controlMember = await this.memberService.insertControl(otherParams);
    this.notifyUpdatedMemberConfig({ member: controlMember, org });
    await this.journeyService.createControl({ memberId: controlMember.id, orgId });

    const contentKey = RegisterInternalKey.newControlMember;
    const newControlMemberEvent: IInternalDispatch = {
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(contentKey, controlMember.id),
      notificationType: NotificationType.textSms,
      recipientClientId: controlMember.id,
      contentKey,
    };
    this.eventEmitter.emit(EventType.notifyDispatch, newControlMemberEvent);

    const eventSlackMessageParams: IEventNotifySlack = {
      header: `*New _control_ member*`,
      message: `${controlMember.firstName} [${controlMember.id}]`,
      icon: SlackIcon.info,
      channel: SlackChannel.support,
      orgName: org.name,
    };
    this.eventEmitter.emit(GlobalEventType.notifySlack, eventSlackMessageParams);

    return controlMember;
  }

  protected notifyUpdatedMemberConfig({
    member,
    memberConfig,
    org,
    firstLoggedInAt,
  }: {
    member?: Member;
    memberConfig?: MemberConfig;
    org?: Org;
    firstLoggedInAt?: Date;
  }) {
    const settings: Partial<IUpdateClientSettings> = omitBy(
      {
        type: InnerQueueTypes.updateClientSettings,
        id: memberConfig?.memberId?.toString() || member.id.toString(),
        clientCategory: ClientCategory.member,
        phone: member?.phone,
        firstName: member?.firstName,
        lastName: member?.lastName,
        orgName: org?.name,
        zipCode: member?.zipCode || org?.zipCode,
        language: memberConfig?.language,
        platform: memberConfig?.platform,
        isPushNotificationsEnabled: memberConfig?.isPushNotificationsEnabled,
        isAppointmentsReminderEnabled: memberConfig?.isAppointmentsReminderEnabled,
        isRecommendationsEnabled: memberConfig?.isRecommendationsEnabled,
        isTodoNotificationsEnabled: memberConfig?.isTodoNotificationsEnabled,
        externalUserId: memberConfig?.externalUserId,
        firstLoggedInAt,
      },
      isUndefined,
    );
    this.logger.info(settings, MemberBase.name, this.notifyUpdatedMemberConfig.name);
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);
  }
}
