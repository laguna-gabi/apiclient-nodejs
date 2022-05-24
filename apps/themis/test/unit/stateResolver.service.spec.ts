import { generateId, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { StateResolverModule, StateResolverService } from '../../src/stateResolver';
import {
  generateBarrierEvent,
  generateCarePlanEvent,
  generateEngineResult,
  generateMemberFacts,
} from '../generators';
import { Action, EngineAction, LookupResult, TargetEntity } from '../../src/rules/types';
import { ErrorType, Errors } from '../../src/common/errors';
import {
  mockGenerateBarrier,
  mockGenerateBarrierType,
  mockGenerateCarePlan,
  mockGenerateCarePlanType,
} from '@argus/hepiusClient';

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
      const memberId = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [mockGenerateBarrier({ type: mockGenerateBarrierType({ id: barrierType1 }) })],
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
      const memberId = generateId();
      const barrierType = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [mockGenerateBarrier({ type: mockGenerateBarrierType({ id: barrierType }) })],
        carePlans: [
          mockGenerateCarePlan({ type: mockGenerateCarePlanType({ id: carePlanType1 }) }),
        ],
      });
      const carePlanType2 = generateId();
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

  describe('lookupCarePlan', () => {
    it(`should find carePlan by type and return the parent barrierId`, async () => {
      const carePlanType1 = generateId();
      const memberId = generateId();
      const barrierType = generateId();
      const barrierId = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [
          mockGenerateBarrier({
            type: mockGenerateBarrierType({ id: barrierType }),
            id: barrierId,
          }),
        ],
        carePlans: [
          mockGenerateCarePlan({ type: mockGenerateCarePlanType({ id: carePlanType1 }) }),
        ],
      });
      const carePlanEvent = generateCarePlanEvent({
        type: carePlanType1,
        parentEntityType: barrierType,
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (private method)
      const result: LookupResult = await service.lookupCarePlan(memberFacts, carePlanEvent.params);
      expect(result).toEqual({ found: true, parentId: barrierId });
    });

    it(`should return false when carePlan was not found`, async () => {
      const carePlanType1 = generateId();
      const memberId = generateId();
      const barrierType = generateId();
      const barrierId = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [
          mockGenerateBarrier({
            type: mockGenerateBarrierType({ id: barrierType }),
            id: barrierId,
          }),
        ],
        carePlans: [
          mockGenerateCarePlan({ type: mockGenerateCarePlanType({ id: carePlanType1 }) }),
        ],
      });
      const carePlanEvent = generateCarePlanEvent({
        parentEntityType: barrierType,
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (private method)
      const result: LookupResult = await service.lookupCarePlan(memberFacts, carePlanEvent.params);
      expect(result).toEqual({ found: false, parentId: barrierId });
    });

    it(`should throw error when parent barrier not found`, async () => {
      const carePlanType1 = generateId();
      const memberId = generateId();
      const barrierType = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        carePlans: [
          mockGenerateCarePlan({ type: mockGenerateCarePlanType({ id: carePlanType1 }) }),
        ],
      });
      const carePlanEvent = generateCarePlanEvent({
        type: carePlanType1,
        parentEntityType: barrierType,
      });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (private method)
      await expect(service.lookupCarePlan(memberFacts, carePlanEvent.params)).rejects.toThrow(
        Error(Errors.get(ErrorType.parentNotFound)),
      );
    });
  });

  describe('lookupBarrier', () => {
    it(`should find barrier by type`, async () => {
      const barrierType1 = generateId();
      const memberId = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [mockGenerateBarrier({ type: mockGenerateBarrierType({ id: barrierType1 }) })],
      });
      const barrierEvent = generateBarrierEvent({ type: barrierType1 });

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (private method)
      const result: LookupResult = await service.lookupBarrier(memberFacts, barrierEvent.params);
      expect(result).toEqual({ found: true, parentId: undefined });
    });

    it(`should return false when barrier was not found`, async () => {
      const memberId = generateId();
      const memberFacts = generateMemberFacts({
        memberInfo: { id: memberId },
        barriers: [mockGenerateBarrier()],
      });
      const barrierEvent = generateBarrierEvent();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (private method)
      const result: LookupResult = await service.lookupBarrier(memberFacts, barrierEvent.params);
      expect(result).toEqual({ found: false, parentId: undefined });
    });
  });
});
