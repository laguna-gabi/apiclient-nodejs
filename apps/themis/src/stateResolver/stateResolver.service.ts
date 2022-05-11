import { Injectable } from '@nestjs/common';
import { EngineResult } from 'json-rules-engine';
import {
  Action,
  EngineAction,
  EngineEvent,
  EventParams,
  MemberFacts,
  TargetEntity,
} from '../rules/types';

@Injectable()
export class StateResolverService {
  private lookupFunctions = new Map<
    TargetEntity,
    (currentState: MemberFacts, eventParams: EventParams) => boolean
  >([
    [TargetEntity.barrier, this.lookupBarrier],
    [TargetEntity.carePlan, this.lookupCarePlan],
  ]);

  private currentState: MemberFacts;

  async calcChanges(engineResult: EngineResult, memberFacts: MemberFacts): Promise<EngineAction[]> {
    this.currentState = memberFacts;

    // "create" events
    const result: EngineAction[] = [];
    engineResult.events.map((event: EngineEvent) => {
      const { type: targetEntity, params: eventParams } = event;
      const { parentEntityType, parentEntity, type: entityType } = eventParams;

      const found = this.lookup(targetEntity, eventParams);
      if (!found) {
        const engineAction = {
          action: Action.create,
          targetEntity,
          entityType,
          parentEntity,
          parentEntityType,
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

  /**************************************** Lookup functions  **************************************/

  private lookupCarePlan(currentState: MemberFacts, eventParams: EventParams): boolean {
    for (const carePlan of currentState.carePlans) {
      // todo: figure out how to populate the type of the parent, if needs to be unique only in context
      if (carePlan.type === eventParams.type) {
        return true;
      }
    }
    return false;
  }

  private lookupBarrier(currentState: MemberFacts, eventParams: EventParams): boolean {
    for (const barrier of currentState.barriers) {
      if (barrier.type === eventParams.type) {
        return true;
      }
    }
    return false;
  }
}
