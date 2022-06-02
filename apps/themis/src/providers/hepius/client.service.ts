import {
  Barrier,
  CarePlan,
  Caregiver,
  CreateCarePlanParams,
  HepiusMessagePatterns,
} from '@argus/hepiusClient';
import { ServiceClientId, ServiceName } from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class HepiusClientService {
  constructor(@Inject(ServiceName.hepius) private readonly hepiusClient: ClientProxy) {}

  async getCaregiversByMemberId({ memberId }: { memberId: string }): Promise<Caregiver[]> {
    return this.hepiusClient
      .send<Caregiver[]>(
        { cmd: HepiusMessagePatterns.getCaregiversByMemberId },
        { memberId, clientId: ServiceClientId.themis },
      )
      .toPromise();
  }

  async getMemberBarriers({ memberId }: { memberId: string }): Promise<Barrier[]> {
    return this.hepiusClient
      .send<Barrier[]>(
        { cmd: HepiusMessagePatterns.getMemberBarriers },
        { memberId, clientId: ServiceClientId.themis },
      )
      .toPromise();
  }

  async getMemberCarePlans({ memberId }: { memberId: string }): Promise<CarePlan[]> {
    return this.hepiusClient
      .send<CarePlan[]>(
        { cmd: HepiusMessagePatterns.getMemberCarePlans },
        { memberId, clientId: ServiceClientId.themis },
      )
      .toPromise();
  }

  async createCarePlan({
    createCarePlanParams,
  }: {
    createCarePlanParams: CreateCarePlanParams;
  }): Promise<CarePlan> {
    return this.hepiusClient
      .send<CarePlan>(
        { cmd: HepiusMessagePatterns.createCarePlan },
        { createCarePlanParams, clientId: ServiceClientId.themis },
      )
      .toPromise();
  }
}
