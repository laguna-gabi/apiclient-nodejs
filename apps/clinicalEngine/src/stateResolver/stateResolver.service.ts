import { Injectable } from '@nestjs/common';
import { EngineResult } from 'json-rules-engine';
import {
  Action,
  Barrier,
  CarePlan,
  EngineAction,
  EventParams,
  MemberFacts,
  TargetEntity,
} from '../rules/types';

interface CurrentState {
  barriers: { entity: Barrier; inEngineResult: boolean }[];
  carePlans: { entity: CarePlan; inEngineResult: boolean }[];
}

@Injectable()
export class StateResolverService {
  private lookupFunctions = new Map<
    TargetEntity,
    (currentState: CurrentState, eventParams: EventParams) => boolean
  >([
    [TargetEntity.barrier, StateResolverService.lookupBarrier],
    [TargetEntity.carePlan, StateResolverService.lookupCarePlan],
  ]);

  private currentState: CurrentState = {
    barriers: [],
    carePlans: [],
  };

  async calcChanges(engineResult: EngineResult, memberFacts: MemberFacts): Promise<EngineAction[]> {
    this.loadCurrentState(memberFacts);

    // "create" events
    const result: EngineAction[] = [];
    engineResult.events.forEach((event) => {
      const targetEntity = event.type as TargetEntity;
      const eventParams = event.params as EventParams;

      const found = this.lookup(targetEntity, eventParams);
      if (!found) {
        const engineAction = {
          action: Action.create,
          targetEntity: targetEntity,
          entityType: eventParams.type,
          parentEntity: eventParams.parentEntity,
          parentEntityType: eventParams.parentEntityType,
        };
        result.push(engineAction);
      }
    });

    return result;
  }

  private lookup(targetEntity: TargetEntity, eventParams: EventParams): boolean {
    const lookupFunction = this.lookupFunctions.get(targetEntity);
    return lookupFunction(this.currentState, eventParams);
  }

  private loadCurrentState(memberFacts: MemberFacts) {
    this.currentState.barriers = memberFacts.barriers.map((barrier) => ({
      entity: barrier,
      inEngineResult: false,
    }));
    this.currentState.carePlans = memberFacts.carePlans.map((carePlan) => ({
      entity: carePlan,
      inEngineResult: false,
    }));
  }

  /**************************************** Lookup functions  **************************************/

  private static lookupCarePlan(currentState: CurrentState, eventParams: EventParams): boolean {
    for (const carePlan of currentState.carePlans) {
      // todo: figure out how to populate the type of the parent, if needs to be unique only in context
      if (carePlan.entity.type === eventParams.type) {
        carePlan.inEngineResult = true;
        return true;
      }
    }
    return false;
  }

  private static lookupBarrier(currentState: CurrentState, eventParams: EventParams): boolean {
    for (const barrier of currentState.barriers) {
      if (barrier.entity.type === eventParams.type) {
        barrier.inEngineResult = true;
        return true;
      }
    }
    return false;
  }
}
