import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ErrorType,
  Errors,
  EventType,
  IDispatchParams,
  IEventNotifyQueue,
  IEventOnNewMember,
  LoggerService,
  QueueType,
  getCorrelationId,
} from '../common';
import { UserService } from '../user';
import { CreateMemberParams, Member, MemberConfig, MemberService } from '.';
import {
  IEventNotifySlack,
  IUpdateClientSettings,
  InnerQueueTypes,
  InternalKey,
  InternalNotificationType,
  SlackChannel,
  SlackIcon,
  generateDispatchId,
} from '@lagunahealth/pandora';
import { FeatureFlagService } from '../providers';
import { isUndefined, omitBy } from 'lodash';
import { Types } from 'mongoose';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly logger: LoggerService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams): Promise<Member> {
    const control = !createMemberParams.userId && (await this.featureFlagService.isControlGroup());
    if (control) {
      return this.createControlMember(createMemberParams);
    } else {
      return this.createRealMember(createMemberParams);
    }
  }

  async createRealMember(createMemberParams: CreateMemberParams): Promise<Member> {
    this.logger.info(createMemberParams, MemberBase.name, this.createRealMember.name);

    const primaryUserId = createMemberParams.userId
      ? Types.ObjectId(createMemberParams.userId)
      : await this.userService.getAvailableUser();

    const user = await this.userService.get(primaryUserId.toString());

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const { member, memberConfig } = await this.memberService.insert(
      createMemberParams,
      primaryUserId,
    );
    const { platform } = await this.memberService.getMemberConfig(member.id);
    this.notifyUpdatedMemberConfig({ member, memberConfig });

    const eventNewMemberParams: IEventOnNewMember = { member, user, platform };
    this.eventEmitter.emit(EventType.onNewMember, eventNewMemberParams);

    const eventSlackMessageParams: IEventNotifySlack = {
      /* eslint-disable-next-line max-len */
      message: `*New customer*\n${member.firstName} [${member.id}],\nassigned to ${user.firstName}.`,
      icon: SlackIcon.info,
      channel: SlackChannel.support,
    };
    this.eventEmitter.emit(EventType.notifySlack, eventSlackMessageParams);

    return member;
  }

  async createControlMember(createMemberParams: CreateMemberParams): Promise<Member> {
    this.logger.info(createMemberParams, MemberBase.name, this.createControlMember.name);
    const controlMember = await this.memberService.insertControl(createMemberParams);
    this.notifyUpdatedMemberConfig({ member: controlMember });

    const newControlMemberEvent: IDispatchParams = {
      memberId: controlMember.id,
      type: InternalNotificationType.textSmsToMember,
      correlationId: getCorrelationId(this.logger),
      dispatchId: generateDispatchId(InternalKey.newControlMember, controlMember.id),
      metadata: {
        contentType: InternalKey.newControlMember,
      },
    };
    this.eventEmitter.emit(EventType.notifyDispatch, newControlMemberEvent);
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
