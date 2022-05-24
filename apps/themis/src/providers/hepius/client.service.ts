import { Caregiver, HepiusMessagePatterns } from '@argus/hepiusClient';
import { ServiceName } from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class HepiusClientService {
  constructor(@Inject(ServiceName.hepius) private readonly hepiusClient: ClientProxy) {}

  async getCaregiversByMemberId({ memberId }: { memberId: string }): Promise<Caregiver[]> {
    return this.hepiusClient
      .send<Caregiver[]>({ cmd: HepiusMessagePatterns.getCaregiversByMemberId }, { memberId })
      .toPromise();
  }
}
