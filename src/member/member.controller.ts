import { Body, Controller, HttpException, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggingInterceptor, apiPrefix } from '../common';
import { CreateMemberParams, Member, MemberService } from '.';
import { Public } from '../auth/decorators/public.decorator';
import { UserService } from '../user';
import { MemberBase } from './member.interfaces';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/members`)
export class MemberController extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
  ) {
    super(memberService, eventEmitter, userService);
  }

  @Public()
  @Post('create')
  async createMember(@Body() createMemberParams: CreateMemberParams): Promise<Member> {
    try {
      const { id } = await super.createMember(createMemberParams);
      return { id } as Member;
    } catch (ex) {
      throw new HttpException(ex.message, HttpStatus.BAD_REQUEST);
    }
  }
}
