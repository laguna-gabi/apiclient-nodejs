import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { FetcherModule, FetcherService } from '../../src/fetcher';
import {
  CreateCarePlanParams,
  mockGenerateBarrier,
  mockGenerateCarePlan,
  mockGenerateCaregiver,
} from '@argus/hepiusClient';
import { HepiusClientService } from '../../src/providers';
import { generateEngineAction } from '../generators';
import { TargetEntity } from '../../src/rules/types';
import { LoggerService } from '../../src/common';

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
    mockLogger(module.get<LoggerService>(LoggerService));
    hepiusClientService = module.get<HepiusClientService>(HepiusClientService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('fetchData', () => {
    let mockHepiusClientServiceGetCaregiversByMemberId: jest.SpyInstance;
    let mockHepiusClientServiceGetMemberBarriers: jest.SpyInstance;
    let mockHepiusClientServiceGetMemberCarePlans: jest.SpyInstance;

    beforeAll(() => {
      mockHepiusClientServiceGetCaregiversByMemberId = jest.spyOn(
        hepiusClientService,
        `getCaregiversByMemberId`,
      );
      mockHepiusClientServiceGetMemberBarriers = jest.spyOn(
        hepiusClientService,
        `getMemberBarriers`,
      );
      mockHepiusClientServiceGetMemberCarePlans = jest.spyOn(
        hepiusClientService,
        `getMemberCarePlans`,
      );
    });

    afterEach(() => {
      mockHepiusClientServiceGetCaregiversByMemberId.mockReset();
      mockHepiusClientServiceGetMemberBarriers.mockReset();
      mockHepiusClientServiceGetMemberCarePlans.mockReset();
    });

    it(`should fetch data for member by id`, async () => {
      const memberId = generateId();
      const carePlan = mockGenerateCarePlan();
      const barrier = mockGenerateBarrier();
      const caregiver = mockGenerateCaregiver();

      mockHepiusClientServiceGetMemberCarePlans.mockResolvedValue([carePlan]);
      mockHepiusClientServiceGetMemberBarriers.mockResolvedValue([barrier]);
      mockHepiusClientServiceGetCaregiversByMemberId.mockResolvedValue([caregiver]);

      const facts = await service.fetchData(memberId);

      expect(mockHepiusClientServiceGetMemberCarePlans).toHaveBeenCalledWith({
        memberId,
      });
      expect(mockHepiusClientServiceGetMemberBarriers).toHaveBeenCalledWith({
        memberId,
      });
      expect(mockHepiusClientServiceGetCaregiversByMemberId).toHaveBeenCalledWith({
        memberId,
      });

      expect(facts.carePlans).toEqual([carePlan]);
      expect(facts.barriers).toEqual([barrier]);
      expect(facts.caregivers).toEqual([caregiver]);
    });
  });

  describe('applyChanges', () => {
    let mockHepiusClientServiceCreateCarePlan: jest.SpyInstance;

    beforeAll(() => {
      mockHepiusClientServiceCreateCarePlan = jest.spyOn(hepiusClientService, `createCarePlan`);
      mockHepiusClientServiceCreateCarePlan.mockResolvedValue(undefined);
    });

    afterEach(() => {
      mockHepiusClientServiceCreateCarePlan.mockReset();
    });

    describe('applyChanges', () => {
      let mockFetcherHandleBarrierAction: jest.SpyInstance;
      let mockFetcherHandleCarePlanAction: jest.SpyInstance;

      beforeAll(() => {
        mockFetcherHandleBarrierAction = jest.spyOn(service, `handleBarrierAction`);
        mockFetcherHandleCarePlanAction = jest.spyOn(service, `handleCarePlanAction`);
      });

      afterEach(() => {
        mockFetcherHandleBarrierAction.mockReset();
        mockFetcherHandleCarePlanAction.mockReset();
      });

      afterAll(() => {
        mockFetcherHandleBarrierAction.mockRestore();
        mockFetcherHandleCarePlanAction.mockRestore();
      });

      it(`should call the right handler for every action`, async () => {
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

    it(`should create care plan on handleCarePlanAction with the right params`, async () => {
      const carePlanAction = generateEngineAction({
        targetEntity: TargetEntity.carePlan,
        parentEntity: TargetEntity.barrier,
        parentEntityId: generateId(),
      });

      const createCarePlanParams: CreateCarePlanParams = {
        memberId: carePlanAction.memberId,
        type: { id: carePlanAction.entityType },
        barrierId: carePlanAction.parentEntityId,
      };
      await service.handleCarePlanAction(carePlanAction);

      expect(mockHepiusClientServiceCreateCarePlan).toHaveBeenCalledWith(createCarePlanParams);
    });
  });
});
