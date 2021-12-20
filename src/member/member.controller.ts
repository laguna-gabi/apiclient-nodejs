import { Body, Controller, HttpException, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService, LoggingInterceptor, Public, apiPrefix } from '../common';
import { CreateMemberParams, Member, MemberBase, MemberService } from '.';
import { UserService } from '../user';
import { FeatureFlagService } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/members`)
export class MemberController extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly logger: LoggerService,
  ) {
    super(memberService, eventEmitter, userService, featureFlagService, logger);
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
