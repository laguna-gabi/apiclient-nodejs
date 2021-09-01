import { MemberService } from './member.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../user';
import { EventType } from '../common';
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

    this.eventEmitter.emit(EventType.collectUsersDataBridge, {
      member,
      userId: primaryUserId,
      platform,
    });

    return member;
  }
}
