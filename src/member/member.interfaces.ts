import { MemberService } from './member.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../user';
import { EventType, IEventNewMember } from '../common';
import { CreateMemberParams } from './member.dto';

export class MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
  ) {}

  async createMember(createMemberParams: CreateMemberParams) {
    const users = await this.userService.getRegisteredUsers();
    const primaryUserId = await this.memberService.getAvailableUser(users);

    const member = await this.memberService.insert(createMemberParams, primaryUserId);
    const { platform } = await this.memberService.getMemberConfig(member.id);

    const user = await this.userService.get(primaryUserId);
    const eventParams: IEventNewMember = { member, user, platform };
    this.eventEmitter.emit(EventType.newMember, eventParams);

    return member;
  }
}
