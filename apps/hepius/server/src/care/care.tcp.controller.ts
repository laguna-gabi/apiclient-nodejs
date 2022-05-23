import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { CarePlan, MemberCommands } from '@argus/hepiusClient';
import { CareService } from './care.service';

@UseInterceptors(LoggingInterceptor)
@Controller()
export class CareTcpController {
  constructor(readonly careService: CareService) {}

  @MessagePattern({ cmd: MemberCommands.getMemberCarePlans }, Transport.TCP)
  async getMemberCarePlans({ memberId }: { memberId: string }): Promise<CarePlan[]> {
    return this.careService.getMemberCarePlans(memberId);
  }
}
