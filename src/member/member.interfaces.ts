import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EventType,
  IEventNewMember,
  IEventRequestAppointment,
  IEventSlackMessage,
  SlackChannel,
  SlackIcon,
} from '../common';
import { UserService } from '../user';
import { CreateMemberParams, Member, MemberService } from '.';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams): Promise<Member> {
    const primaryUserId = await this.userService.getAvailableUser();

    const member = await this.memberService.insert(createMemberParams, primaryUserId);
    const { platform } = await this.memberService.getMemberConfig(member.id);

    const user = await this.userService.get(primaryUserId);
    const eventNewMemberParams: IEventNewMember = { member, user, platform };
    this.eventEmitter.emit(EventType.newMember, eventNewMemberParams);

    const eventRequestAppointmentParams: IEventRequestAppointment = { user, member };
    this.eventEmitter.emit(EventType.requestAppointment, eventRequestAppointmentParams);

    const eventSlackMessageParams: IEventSlackMessage = {
      // eslint-disable-next-line max-len
      message: `*New customer*\n${member.firstName} [${member.id}],\nassigned to ${user.firstName}.`,
      icon: SlackIcon.info,
      channel: SlackChannel.support,
    };
    this.eventEmitter.emit(EventType.slackMessage, eventSlackMessageParams);

    return member;
  }
}
