import { Injectable } from '@nestjs/common';

const mockFactsObject = {
  memberInfo: { scheduledAppointments: 0, appointmentsToBeScheduled: 0, livesAlone: true },
  caregivers: ['x', 'y'],
  barriers: [{ type: 'appointment-follow-up-unclear' }, { type: 'loneliness' }],
};

@Injectable()
export class FetcherService {
  async fetchData(memberId: string) {
    // todo: get data from server (hepius)
    // for now - fake data
    return mockFactsObject;
  }

  async applyChanges(changes) {
    // todo: create new entities
    // delete not satisfied entities
  }
}
