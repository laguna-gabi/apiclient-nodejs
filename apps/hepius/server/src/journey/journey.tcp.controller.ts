import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Caregiver, HepiusMessagePatterns } from '@argus/hepiusClient';
import { CaregiverService, JourneyService } from '.';

@UseInterceptors(LoggingInterceptor)
@Controller()
export class JourneyTcpController {
  constructor(
    readonly journeyService: JourneyService,
    readonly caregiverService: CaregiverService,
  ) {}

  @MessagePattern({ cmd: HepiusMessagePatterns.getCaregiversByMemberId }, Transport.TCP)
  async getCaregiversByMemberId({ memberId }: { memberId: string }): Promise<Caregiver[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.caregiverService.getCaregivers({ memberId, journeyId });
  }
}
