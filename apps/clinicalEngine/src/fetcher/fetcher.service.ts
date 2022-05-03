import { Injectable } from '@nestjs/common';
import { BarrierStatus, MemberFacts } from '../rules/types';

const mockFactsObject: MemberFacts = {
  memberInfo: {
    scheduledAppointments: 0,
    appointmentsToBeScheduled: 0,
    livesAlone: true,
    nested: { example: 1 },
  },
  caregivers: ['x', 'y'],
  barriers: [
    { type: 'appointment-follow-up-unclear', status: BarrierStatus.active },
    { type: 'loneliness2', status: BarrierStatus.active },
    { type: 'not-satisfied', status: BarrierStatus.active },
  ],
};

@Injectable()
export class FetcherService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchData(memberId: string) {
    // todo: get data from server (hepius)
    // for now - fake data
    return mockFactsObject;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async applyChanges(changes) {
    // todo: create new entities
    // delete not satisfied entities
  }
}
