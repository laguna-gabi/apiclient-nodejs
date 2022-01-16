import {
  ClientCategory,
  IEventNotifySlack,
  IUpdateClientSettings,
  InnerQueueTypes,
  InternalKey,
  NotificationType,
  QueueType,
  SlackChannel,
  SlackIcon,
  generateDispatchId,
} from '@lagunahealth/pandora';
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

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly twilio: TwilioService,
    readonly logger: LoggerService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams): Promise<Member> {
    const phoneCarrier = await this.twilio.getPhoneCarrier(createMemberParams.phone);
    const control = !createMemberParams.userId && (await this.featureFlagService.isControlGroup());
    if (control) {
      return this.createControlMember({ ...createMemberParams, phoneCarrier });
    } else {
      return this.createRealMember({ ...createMemberParams, phoneCarrier });
    }
  }

  async createRealMember(params: InternalCreateMemberParams): Promise<Member> {
    this.logger.info(params, MemberBase.name, this.createRealMember.name);

    const primaryUserId = params.userId
      ? Types.ObjectId(params.userId)
      : await this.userService.getAvailableUser();

    const user = await this.userService.get(primaryUserId.toString());

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const { member, memberConfig } = await this.memberService.insert(params, primaryUserId);
    const { platform } = await this.memberService.getMemberConfig(member.id);
    this.notifyUpdatedMemberConfig({ member, memberConfig });

    const eventNewMemberParams: IEventOnNewMember = { member, user, platform };
    this.eventEmitter.emit(EventType.onNewMember, eventNewMemberParams);

    const eventSlackMessageParams: IEventNotifySlack = {
      header: `*New _real_ member*`,
      message: `${member.firstName} [${member.id}]\nAssigned to ${user.firstName}`,
      icon: SlackIcon.info,
      channel: SlackChannel.support,
      orgName: member.org.name,
    };
    this.eventEmitter.emit(EventType.notifySlack, eventSlackMessageParams);

    return member;
  }

  async createControlMember(params: InternalCreateMemberParams): Promise<Member> {
    this.logger.info(params, MemberBase.name, this.createControlMember.name);
    const controlMember = await this.memberService.insertControl(params);
    this.notifyUpdatedMemberConfig({ member: controlMember });

    const contentKey = InternalKey.newControlMember;
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
      orgName: controlMember.org.name,
    };
    this.eventEmitter.emit(EventType.notifySlack, eventSlackMessageParams);

    return controlMember;
  }

  protected notifyUpdatedMemberConfig({
    member,
    memberConfig,
  }: {
    member?: Member;
    memberConfig?: MemberConfig;
  }) {
    const settings: Partial<IUpdateClientSettings> = omitBy(
      {
        type: InnerQueueTypes.updateClientSettings,
        id: memberConfig?.memberId?.toString() || member.id.toString(),
        clientCategory: ClientCategory.member,
        phone: member?.phone,
        firstName: member?.firstName,
        lastName: member?.lastName,
        orgName: member?.org?.name,
        honorific: member?.honorific,
        zipCode: member?.zipCode || member?.org?.zipCode,
        language: memberConfig?.language,
        platform: memberConfig?.platform,
        isPushNotificationsEnabled: memberConfig?.isPushNotificationsEnabled,
        isAppointmentsReminderEnabled: memberConfig?.isAppointmentsReminderEnabled,
        isRecommendationsEnabled: memberConfig?.isRecommendationsEnabled,
        externalUserId: memberConfig?.externalUserId,
        firstLoggedInAt: memberConfig?.firstLoggedInAt,
      },
      isUndefined,
    );
    this.logger.info(settings, MemberBase.name, this.notifyUpdatedMemberConfig.name);
    const eventParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(EventType.notifyQueue, eventParams);
  }
}
