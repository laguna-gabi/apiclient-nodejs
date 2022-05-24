import { Injectable } from '@nestjs/common';
import { EngineResult } from 'json-rules-engine';
import {
  Action,
  EngineAction,
  EngineEvent,
  EventParams,
  LookupResult,
  MemberFacts,
  TargetEntity,
} from '../rules/types';
import { LoggerService } from '../common';
import { ErrorType, Errors } from '../common/errors';
import { formatEx } from '@argus/pandora';

@Injectable()
export class StateResolverService {
  constructor(private logger: LoggerService) {}
  private currentState: MemberFacts;
  private lookupFunctions = new Map<
    TargetEntity,
    (currentState: MemberFacts, eventParams: EventParams) => Promise<LookupResult>
  >([
    [TargetEntity.barrier, this.lookupBarrier],
    [TargetEntity.carePlan, this.lookupCarePlan],
  ]);

  async calcChanges(engineResult: EngineResult, memberFacts: MemberFacts): Promise<EngineAction[]> {
    this.currentState = memberFacts;

    // "create" events
    const result: EngineAction[] = [];
    await Promise.all(
      engineResult.events.map(async (event: EngineEvent) => {
        const { type: targetEntity, params: eventParams } = event;
        const { parentEntityType, parentEntity, type: entityType } = eventParams;

        try {
          const { found, parentId } = await this.lookup(targetEntity, eventParams);
          if (!found) {
            const engineAction: EngineAction = {
              memberId: memberFacts.memberInfo.id,
              action: Action.create,
              targetEntity,
              entityType,
              parentEntity,
              parentEntityType,
              parentEntityId: parentId,
            };
            result.push(engineAction);
          }
        } catch (ex) {
          this.logger.error(
            eventParams,
            StateResolverService.name,
            this.lookupCarePlan.name,
            formatEx(ex),
          );
        }
      }),
    );
    return result;
  }

  private async lookup(
    targetEntity: TargetEntity,
    eventParams: EventParams,
  ): Promise<LookupResult> {
    const lookupFunction = this.lookupFunctions.get(targetEntity);
    return lookupFunction(this.currentState, eventParams);
  }

  /**************************************** Lookup functions  **************************************/

  private async lookupCarePlan(
    currentState: MemberFacts,
    eventParams: EventParams,
  ): Promise<LookupResult> {
    let found = false;
    for (const carePlan of currentState.carePlans) {
      // todo: figure out how to populate the type of the parent, if needs to be unique only in context
      if (carePlan.type.id === eventParams.type) {
        found = true;
        break;
      }
    }

    const parentBarrier = currentState.barriers.find(
      (barrier) => barrier.type.id === eventParams.parentEntityType,
    );
    if (!parentBarrier) {
      throw new Error(Errors.get(ErrorType.parentNotFound));
    }

    return { found, parentId: parentBarrier.id };
  }

  private async lookupBarrier(
    currentState: MemberFacts,
    eventParams: EventParams,
  ): Promise<LookupResult> {
    for (const barrier of currentState.barriers) {
      if (barrier.type.id === eventParams.type) {
        return { found: true };
      }
    }
    return { found: false };
  }
}
