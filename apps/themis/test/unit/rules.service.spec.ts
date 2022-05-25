import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { RulesModule, RulesService } from '../../src/rules';
import { generateMemberFacts } from '../generators';
import { EngineEvent, TargetEntity } from '../../src/rules/types';
import { LoggerService } from '../../src/common';
import { mockGenerateBarrier, mockGenerateBarrierType } from '@argus/hepiusClient';

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
      // todo: change to real rule names and entity types
      describe('content-about-combating-loneliness', () => {
        it(`should create an event when the rule is satisfied`, async () => {
          const memberFacts = generateMemberFacts({
            barriers: [
              mockGenerateBarrier({ type: mockGenerateBarrierType({ id: 'loneliness' }) }),
            ],
          });

          const engineResult = await service.run(memberFacts);
          const event: EngineEvent = {
            type: TargetEntity.carePlan,
            params: {
              type: 'content-about-combating-loneliness',
              parentEntity: TargetEntity.barrier,
              parentEntityType: 'loneliness',
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
              type: 'content-about-combating-loneliness',
              parentEntity: TargetEntity.barrier,
              parentEntityType: 'loneliness',
            },
          };
          expect(engineResult.events).not.toEqual(expect.arrayContaining([event]));
          expect(engineResult.failureEvents).toEqual(expect.arrayContaining([event]));
        });
      });
    });
  });
});
