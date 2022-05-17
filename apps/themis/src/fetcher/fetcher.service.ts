import { Injectable } from '@nestjs/common';
import { HepiusClientService } from '../providers';
import { BarrierStatus, MemberFacts } from '../rules/types';

const mockFactsObject: MemberFacts = {
  memberInfo: {
    scheduledAppointments: 0,
    appointmentsToBeScheduled: 0,
    livesAlone: true,
    nested: { example: 1 },
  },
  barriers: [
    { type: 'appointment-follow-up-unclear', status: BarrierStatus.active },
    { type: 'loneliness', status: BarrierStatus.active },
    { type: 'not-satisfied', status: BarrierStatus.active },
  ],
  carePlans: [],
  caregivers: [],
};

@Injectable()
export class FetcherService {
  constructor(private readonly hepiusClientService: HepiusClientService) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchData(memberId: string): Promise<MemberFacts> {
    // todo: get data from server (hepius)
    // for now - fake data
    return {
      ...mockFactsObject,
      caregivers: await this.hepiusClientService.getCaregiversByMemberId(memberId),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async applyChanges(changes) {
    // todo: create new entities
    // delete not satisfied entities
  }
}
