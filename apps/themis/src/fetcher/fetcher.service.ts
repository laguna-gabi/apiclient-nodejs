import { Injectable } from '@nestjs/common';
import { HepiusClientService } from '../providers';
import { Action, BarrierStatus, EngineAction, MemberFacts, TargetEntity } from '../rules/types';
import { LoggerService } from '../common';

export const mockFactsObject: MemberFacts = {
  memberInfo: {
    id: '123',
    scheduledAppointments: 0,
    appointmentsToBeScheduled: 0,
    livesAlone: true,
    nested: { example: 1 },
  },
  barriers: [
    { id: '1', type: 'appointment-follow-up-unclear', status: BarrierStatus.active },
    { id: '2', type: 'loneliness', status: BarrierStatus.active },
    { id: '3', type: 'not-satisfied', status: BarrierStatus.active },
  ],
  carePlans: [],
  caregivers: [],
};

@Injectable()
export class FetcherService {
  constructor(
    private readonly hepiusClientService: HepiusClientService,
    private logger: LoggerService,
  ) {}
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
  async applyChanges(engineActions: EngineAction[]) {
    this.logger.info({ engineActions }, FetcherService.name, this.applyChanges.name);

    await Promise.all(
      engineActions.map((action) => {
        switch (action.targetEntity) {
          case TargetEntity.barrier: {
            this.handleBarrierAction(action);
            break;
          }
          case TargetEntity.carePlan: {
            this.handleCarePlanAction(action);
            break;
          }
        }
      }),
    );
  }

  async handleBarrierAction(barrierAction: EngineAction) {
    if (barrierAction.action == Action.create) {
      // todo: get createBarrierParams params from common
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const createBarrierParams = {
        memberId: barrierAction.memberId,
        type: barrierAction.entityType,
      };

      // todo: send to hepius - waiting for tcp endpints
    }
  }

  async handleCarePlanAction(carePlanAction: EngineAction) {
    if (carePlanAction.action == Action.create) {
      // todo: get createCarePlanParams params from common

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const createCarePlanParams = {
        memberId: carePlanAction.memberId,
        type: carePlanAction.entityType,
        barrierId: carePlanAction.parentEntityId,
      };

      // todo: send to hepius - waiting for tcp endpints
    }
  }
}
