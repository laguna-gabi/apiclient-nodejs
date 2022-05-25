import { createChangeEvent, generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { ProvidersModule } from '../../src/providers';
import { LoggerService } from '../../src/common';
import { EngineModule, EngineService } from '../../src/engine';
import { FetcherService } from '../../src/fetcher';
import { generateEngineAction, generateEngineResult, generateMemberFacts } from '../generators';
import { StateResolverService } from '../../src/stateResolver';
import { RulesService } from '../../src/rules';

describe(EngineService.name, () => {
  let module: TestingModule;
  // Services:
  let service: EngineService;
  let fetcherService: FetcherService;
  let rulesService: RulesService;
  let stateResolverService: StateResolverService;
  // Mocks:
  let mockFetcherServiceFetchData: jest.SpyInstance;
  let mockRulesServiceRun: jest.SpyInstance;
  let mockStateResolverServiceCalcChanges: jest.SpyInstance;
  let mockFetcherServiceApplyChanges: jest.SpyInstance;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [EngineModule, ProvidersModule],
    }).compile();

    service = module.get<EngineService>(EngineService);
    fetcherService = module.get<FetcherService>(FetcherService);
    rulesService = module.get<RulesService>(RulesService);
    stateResolverService = module.get<StateResolverService>(StateResolverService);

    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('handleEvent', () => {
    beforeAll(() => {
      mockFetcherServiceFetchData = jest.spyOn(fetcherService, `fetchData`);
      mockRulesServiceRun = jest.spyOn(rulesService, `run`);
      mockStateResolverServiceCalcChanges = jest.spyOn(stateResolverService, `calcChanges`);
      mockFetcherServiceApplyChanges = jest.spyOn(fetcherService, `applyChanges`);
    });

    afterEach(() => {
      mockFetcherServiceFetchData.mockReset();
      mockRulesServiceRun.mockReset();
      mockStateResolverServiceCalcChanges.mockReset();
      mockFetcherServiceApplyChanges.mockReset();
    });

    it('should handleEvent', async () => {
      const memberId = generateId();
      const memberFacts = generateMemberFacts({ member: { id: memberId } });
      const engineResult = generateEngineResult();
      const engineAction = generateEngineAction();

      // Mock implementation
      mockFetcherServiceFetchData.mockResolvedValue(memberFacts);
      mockRulesServiceRun.mockResolvedValue([engineResult]);
      mockStateResolverServiceCalcChanges.mockResolvedValue([engineAction]);
      mockFetcherServiceApplyChanges.mockImplementation();

      // apply UUT
      await service.handleEvent(createChangeEvent({ memberId }));

      // Assertions
      expect(mockFetcherServiceFetchData).toHaveBeenCalledWith(memberId);
      expect(mockRulesServiceRun).toHaveBeenCalledWith(memberFacts);
      expect(mockStateResolverServiceCalcChanges).toHaveBeenCalledWith([engineResult], memberFacts);
      expect(mockFetcherServiceApplyChanges).toHaveBeenCalledWith([engineAction]);
    });
  });
});
