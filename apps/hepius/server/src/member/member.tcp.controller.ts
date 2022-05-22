import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common';
import { MemberService } from '.';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Caregiver, MemberCommands } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Controller()
export class MemberTcpController {
  constructor(readonly memberService: MemberService) {}

  @MessagePattern({ cmd: MemberCommands.getCaregiversByMemberId }, Transport.TCP)
  async getCaregiversByMemberId(memberId: string): Promise<Caregiver[]> {
    return this.memberService.getCaregiversByMemberId(memberId);
  }
}
