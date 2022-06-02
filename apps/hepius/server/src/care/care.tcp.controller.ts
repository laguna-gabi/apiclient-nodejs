import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import {
  Barrier,
  CarePlan,
  CreateCarePlanParams,
  HepiusMessagePatterns,
} from '@argus/hepiusClient';
import { CareService } from './care.service';

@UseInterceptors(LoggingInterceptor)
@Controller()
export class CareTcpController {
  constructor(readonly careService: CareService) {}

  @MessagePattern({ cmd: HepiusMessagePatterns.getMemberCarePlans }, Transport.TCP)
  async getMemberCarePlans({ memberId }: { memberId: string }): Promise<CarePlan[]> {
    return this.careService.getMemberCarePlans(memberId);
  }

  @MessagePattern({ cmd: HepiusMessagePatterns.getMemberBarriers }, Transport.TCP)
  async getMemberBarriers({ memberId }: { memberId: string }): Promise<Barrier[]> {
    return this.careService.getMemberBarriers(memberId);
  }

  @MessagePattern({ cmd: HepiusMessagePatterns.createCarePlan }, Transport.TCP)
  async createCarePlan({
    createCarePlanParams,
  }: {
    createCarePlanParams: CreateCarePlanParams;
  }): Promise<CarePlan> {
    return this.careService.createCarePlan(createCarePlanParams);
  }
}
