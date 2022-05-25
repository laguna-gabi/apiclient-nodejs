import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { mockGenerateBarrier, mockGenerateBarrierType } from '@argus/hepiusClient';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BarrierType,
  CarePlanType,
  EngineEvent,
  RulesModule,
  RulesService,
  TargetEntity,
} from '../../src/rules';
import { generateMemberFacts } from '../generators';
import { LoggerService } from '../../src/common';

describe(RulesService.name, () => {
  let module: TestingModule;
  let service: RulesService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [RulesModule],
    }).compile();
    await module.init();
    mockLogger(module.get<LoggerService>(LoggerService));
    service = module.get<RulesService>(RulesService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('rules', () => {
    describe('carePlan rules', () => {
      describe(CarePlanType.extendCareCircle, () => {
        it(`should create an event when the rule is satisfied`, async () => {
          const memberFacts = generateMemberFacts({
            barriers: [
              mockGenerateBarrier({
                type: mockGenerateBarrierType({ id: BarrierType.behaviorLoneliness }),
              }),
            ],
          });

          const engineResult = await service.run(memberFacts);
          const event: EngineEvent = {
            type: TargetEntity.carePlan,
            params: {
              type: CarePlanType.extendCareCircle,
              parentEntity: TargetEntity.barrier,
              parentEntityType: BarrierType.behaviorLoneliness,
            },
          };
          expect(engineResult.events).toEqual(expect.arrayContaining([event]));
        });

        it(`should NOT create an event when the rule is NOT satisfied`, async () => {
          const memberFacts = generateMemberFacts({
            barriers: [mockGenerateBarrier()],
          });

          const engineResult = await service.run(memberFacts);
          const event: EngineEvent = {
            type: TargetEntity.carePlan,
            params: {
              type: CarePlanType.extendCareCircle,
              parentEntity: TargetEntity.barrier,
              parentEntityType: BarrierType.behaviorLoneliness,
            },
          };
          expect(engineResult.events).not.toEqual(expect.arrayContaining([event]));
          expect(engineResult.failureEvents).toEqual(expect.arrayContaining([event]));
        });
      });
    });
  });
});
