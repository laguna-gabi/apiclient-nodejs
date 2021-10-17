import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType, IEventNewMember, IEventRequestAppointment } from '../common';
import { UserService } from '../user';
import { CreateMemberParams } from './member.dto';
import { MemberService } from './member.service';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams) {
    const primaryUserId = await this.userService.getAvailableUser();

    const member = await this.memberService.insert(createMemberParams, primaryUserId);
    const { platform } = await this.memberService.getMemberConfig(member.id);

    const user = await this.userService.get(primaryUserId);
    const eventNewMemberParams: IEventNewMember = { member, user, platform };
    this.eventEmitter.emit(EventType.newMember, eventNewMemberParams);

    const eventRequestAppointmentParams: IEventRequestAppointment = { user, member };
    this.eventEmitter.emit(EventType.requestAppointment, eventRequestAppointmentParams);

    return member;
  }
}
