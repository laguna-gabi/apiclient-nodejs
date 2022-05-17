import { generateId, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { FetcherModule, FetcherService } from '../../src/fetcher';
import { Caregiver, mockGenerateCaregiver } from '@argus/hepiusClient';
import { HepiusClientService } from '../../src/providers/hepius/client.service';

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
});
