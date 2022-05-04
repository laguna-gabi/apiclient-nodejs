import { Body, Controller, HttpException, HttpStatus, Post, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService, LoggingInterceptor, Public, apiPrefix } from '../common';
import { CreateMemberParams, JourneyService, Member, MemberBase, MemberService } from '.';
import { UserService } from '../user';
import { FeatureFlagService, TwilioService } from '../providers';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Caregiver, MemberCommands } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/members`)
export class MemberController extends MemberBase {
  constructor(
    readonly memberService: MemberService,
    readonly eventEmitter: EventEmitter2,
    readonly userService: UserService,
    readonly featureFlagService: FeatureFlagService,
    readonly journeyService: JourneyService,
    readonly twilio: TwilioService,
    readonly logger: LoggerService,
  ) {
    super(
      memberService,
      eventEmitter,
      userService,
      featureFlagService,
      journeyService,
      twilio,
      logger,
    );
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

  @MessagePattern({ cmd: MemberCommands.getCaregiversByMemberId }, Transport.TCP)
  async getCaregiversByMemberId(memberId: string): Promise<Caregiver[]> {
    return this.memberService.getCaregiversByMemberId(memberId);
  }
}
