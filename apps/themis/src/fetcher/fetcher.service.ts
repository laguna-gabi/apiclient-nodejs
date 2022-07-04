import { Injectable } from '@nestjs/common';
import { HepiusClientService } from '../providers';
import { Action, EngineAction, MemberFacts, TargetEntity } from '../rules/types';
import { LoggerService } from '../common';
import { formatEx } from '@argus/pandora';
import { CreateCarePlanParams } from '@argus/hepiusClient';

@Injectable()
export class FetcherService {
  constructor(
    private readonly hepiusClientService: HepiusClientService,
    private logger: LoggerService,
  ) {}
  async fetchData(memberId: string): Promise<MemberFacts> {
    return {
      member: { id: memberId },
      caregivers: await this.hepiusClientService.getCaregiversByMemberId({ memberId }),
      barriers: await this.hepiusClientService.getMemberBarriers({ memberId }),
      carePlans: await this.hepiusClientService.getMemberCarePlans({ memberId }),
    };
  }

  async applyChanges(engineActions: EngineAction[]) {
    this.logger.info({ engineActions }, FetcherService.name, this.applyChanges.name);

    await Promise.all(
      engineActions.map((action) => {
        try {
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
        } catch (ex) {
          this.logger.error({ action }, FetcherService.name, this.applyChanges.name, formatEx(ex));
        }
      }),
    );
  }

  async handleBarrierAction(barrierAction: EngineAction) {
    this.logger.info({ action: barrierAction }, FetcherService.name, this.handleBarrierAction.name);
    if (barrierAction.action == Action.create) {
      // todo: get createBarrierParams params from common
      // todo: send to hepius - waiting for tcp endpoints
    }
  }

  async handleCarePlanAction(carePlanAction: EngineAction) {
    this.logger.info(
      { action: carePlanAction },
      FetcherService.name,
      this.handleCarePlanAction.name,
    );

    if (carePlanAction.action == Action.create) {
      const createCarePlanParams: CreateCarePlanParams = {
        memberId: carePlanAction.memberId,
        type: { id: carePlanAction.entityType },
        barrierId: carePlanAction.parentEntityId,
      };
      await this.hepiusClientService.createCarePlan({
        createCarePlanParams,
      });
    }
  }
}
