import { generateId, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { FetcherModule, FetcherService } from '../../src/fetcher';
import { Caregiver, mockGenerateCaregiver } from '@argus/hepiusClient';
import { HepiusClientService } from '../../src/providers';
import { generateEngineAction } from '../generators';
import { TargetEntity } from '../../src/rules/types';

describe(FetcherService.name, () => {
  let module: TestingModule;
  let service: FetcherService;
  let hepiusClientService: HepiusClientService;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [FetcherModule],
    }).compile();
    service = module.get<FetcherService>(FetcherService);
    hepiusClientService = module.get<HepiusClientService>(HepiusClientService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('fetchData', () => {
    let mockHepiusClientServiceGetCaregiversByMemberId: jest.SpyInstance;

    beforeAll(() => {
      mockHepiusClientServiceGetCaregiversByMemberId = jest.spyOn(
        hepiusClientService,
        `getCaregiversByMemberId`,
      );
    });

    afterEach(() => {
      mockHepiusClientServiceGetCaregiversByMemberId.mockReset();
    });

    it(`should fetch ${Caregiver.name} data for member by id`, async () => {
      const memberId = generateId();
      const caregiver = mockGenerateCaregiver();

      mockHepiusClientServiceGetCaregiversByMemberId.mockResolvedValue([caregiver]);

      const facts = await service.fetchData(memberId);

      expect(mockHepiusClientServiceGetCaregiversByMemberId).toHaveBeenCalledWith(memberId);

      expect(facts.caregivers).toEqual([caregiver]);
    });
  });

  describe('applyChanges', () => {
    let mockFetcherHandleBarrierAction: jest.SpyInstance;
    let mockFetcherHandleCarePlanAction: jest.SpyInstance;

    beforeAll(() => {
      mockFetcherHandleBarrierAction = jest.spyOn(service, `handleBarrierAction`);
      mockFetcherHandleCarePlanAction = jest.spyOn(service, `handleCarePlanAction`);
    });

    afterEach(() => {
      mockFetcherHandleCarePlanAction.mockReset();
      mockFetcherHandleBarrierAction.mockReset();
    });

    it(`should fetch call the right handler for every action`, async () => {
      const barrierAction = generateEngineAction({
        targetEntity: TargetEntity.barrier,
      });
      const carePlanAction = generateEngineAction({
        targetEntity: TargetEntity.carePlan,
      });

      await service.applyChanges([barrierAction, carePlanAction]);

      expect(mockFetcherHandleBarrierAction).toHaveBeenCalledWith(barrierAction);
      expect(mockFetcherHandleCarePlanAction).toHaveBeenCalledWith(carePlanAction);
    });
  });
});
