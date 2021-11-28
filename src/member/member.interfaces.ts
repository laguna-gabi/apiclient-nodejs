import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ContentKey,
  EventType,
  IEventOnNewMember,
  InternalNotifyControlMemberParams,
  Logger,
} from '../common';
import { UserService } from '../user';
import { CreateMemberParams, Member, MemberService } from '.';
import {
  IEventNotifySlack,
  InternalNotificationType,
  SlackChannel,
  SlackIcon,
} from '@lagunahealth/pandora';
import { FeatureFlagService } from '../providers';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly logger: Logger,
  ) {}

  async createMember(createMemberParams: CreateMemberParams): Promise<Member> {
    const control = this.featureFlagService.isControlGroup();
    if (control) {
      return this.createControlMember(createMemberParams);
    } else {
      return this.createRealMember(createMemberParams);
    }
  }

  async createRealMember(createMemberParams: CreateMemberParams): Promise<Member> {
    this.logger.debug(createMemberParams, MemberBase.name, this.createRealMember.name);
    const primaryUserId = await this.userService.getAvailableUser();

    const member = await this.memberService.insert(createMemberParams, primaryUserId);
    const { platform } = await this.memberService.getMemberConfig(member.id);

    const user = await this.userService.get(primaryUserId);
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
    this.logger.debug(createMemberParams, MemberBase.name, this.createControlMember.name);
    const controlMember = await this.memberService.insertControl(createMemberParams);

    const params: InternalNotifyControlMemberParams = {
      memberId: controlMember.id,
      type: InternalNotificationType.textSmsToMember,
      metadata: { contentType: ContentKey.newControlMember },
    };
    this.eventEmitter.emit(EventType.notifyInternalControlMember, params);

    return controlMember;
  }
}
