import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateMemberParams, MemberService } from '.';
import { apiPrefix, Identifier } from '../common';
import { UserService } from '../user';
import { MemberBase } from './member.interfaces';

@Controller(`${apiPrefix}/members`)
export class MemberController extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
  ) {
    super(memberService, eventEmitter, userService);
  }

  @Post('create')
  async createMember(@Body() createMemberParams: CreateMemberParams): Promise<Identifier> {
    try {
      const { id } = await super.createMember(createMemberParams);
      return { id };
    } catch (ex) {
      throw new HttpException(ex.message, HttpStatus.BAD_REQUEST);
    }
  }
}
