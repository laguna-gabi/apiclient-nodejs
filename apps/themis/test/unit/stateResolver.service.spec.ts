import { generateId, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { StateResolverModule, StateResolverService } from '../../src/stateResolver';
import {
  generateBarrier,
  generateBarrierEvent,
  generateCarePlan,
  generateCarePlanEvent,
  generateEngineResult,
  generateMemberFacts,
} from '../generators';
import { Action, EngineAction, TargetEntity } from '../../src/rules/types';

describe(StateResolverService.name, () => {
  let module: TestingModule;
  let service: StateResolverService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [StateResolverModule],
    }).compile();
    service = module.get<StateResolverService>(StateResolverService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Barrier Actions', () => {
    it(`should 'create' only new barriers (that does not exist in the current state)`, async () => {
      const barrierType1 = generateId();
      const barrierType2 = generateId();
      const memberFacts = generateMemberFacts({
        barriers: [generateBarrier({ type: barrierType1 })],
      });
      const barrierEvents = [
        generateBarrierEvent({ type: barrierType1 }),
        generateBarrierEvent({ type: barrierType2 }),
      ];
      const engineResult = generateEngineResult({ events: barrierEvents });

      const result: EngineAction[] = await service.calcChanges(engineResult, memberFacts);
      expect(result.length).toEqual(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: Action.create,
            targetEntity: TargetEntity.barrier,
            entityType: barrierType2,
          }),
        ]),
      );
    });
  });

  describe('CarePlan Actions', () => {
    // eslint-disable-next-line max-len
    it(`should 'create' only new carePlans (that does not exist in the current state)`, async () => {
      const carePlanType1 = generateId();
      const memberFacts = generateMemberFacts({
        carePlans: [generateCarePlan({ type: carePlanType1 })],
      });
      const carePlanType2 = generateId();
      const barrierType = generateId();
      const carePlanEvents = [
        generateCarePlanEvent({ type: carePlanType1, parentEntityType: barrierType }),
        generateCarePlanEvent({ type: carePlanType2, parentEntityType: barrierType }),
      ];
      const engineResult = generateEngineResult({ events: carePlanEvents });

      const result: EngineAction[] = await service.calcChanges(engineResult, memberFacts);
      expect(result.length).toEqual(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: Action.create,
            targetEntity: TargetEntity.carePlan,
            entityType: carePlanType2,
            parentEntityType: barrierType,
            parentEntity: TargetEntity.barrier,
          }),
        ]),
      );
    });
  });
});
