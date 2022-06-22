import { MemberRole } from '@argus/hepiusClient';
import { generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules, generateDailyReportCategoriesInput } from '..';
import { LoggerService } from '../../src/common';
import {
  DailyReport,
  DailyReportCategory,
  DailyReportCategoryTypes,
  DailyReportModule,
  DailyReportQueryInput,
  DailyReportResolver,
  DailyReportService,
} from '../../src/dailyReport';
import { JourneyModule, JourneyService } from '../../src/journey';

describe('DailyReportResolver', () => {
  let resolver: DailyReportResolver;
  let service: DailyReportService;
  let jounreyService: JourneyService;
  let module: TestingModule;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      providers: [DailyReportResolver, LoggerService],
      imports: defaultModules().concat(DailyReportModule, JourneyModule),
    }).compile();

    resolver = module.get<DailyReportResolver>(DailyReportResolver);
    service = module.get<DailyReportService>(DailyReportService);
    jounreyService = module.get<JourneyService>(JourneyService);
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('setDailyReportCategories', () => {
    const dailyReportCategoryInputs = generateDailyReportCategoriesInput();

    it('should be called with daily report input args', async () => {
      const spyOnDailyReportServiceSetDailyReportCategories = jest
        .spyOn(service, 'setDailyReportCategories')
        .mockResolvedValue(null);

      await resolver.setDailyReportCategories(dailyReportCategoryInputs);

      expect(spyOnDailyReportServiceSetDailyReportCategories).toHaveBeenCalledWith(
        dailyReportCategoryInputs,
      );
    });
  });

  describe('getDailyReports', () => {
    let spyOnJourneyServiceGetRecent: jest.SpyInstance;

    beforeAll(() => {
      spyOnJourneyServiceGetRecent = jest.spyOn(jounreyService, 'getRecent');
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: generateId() });
    });

    afterAll(() => {
      spyOnJourneyServiceGetRecent.mockReset();
    });

    it.each([
      [
        'valid start/end dates and records exists in db',
        '2015/01/01',
        [
          {
            date: '2015/01/01',
            categories: [
              { category: DailyReportCategoryTypes.Pain, rank: 2 },
              { category: DailyReportCategoryTypes.Mood, rank: 1 },
            ] as DailyReportCategory[],
          },
          {
            date: '2015/01/02',
            categories: [
              { category: DailyReportCategoryTypes.Appetite, rank: 2 },
              { category: DailyReportCategoryTypes.Mood, rank: 1 },
            ] as DailyReportCategory[],
          },
          {
            date: '2015/01/03',
            categories: [
              { category: DailyReportCategoryTypes.Pain, rank: 2 },
              { category: DailyReportCategoryTypes.Mobility, rank: 1 },
            ] as DailyReportCategory[],
          },
        ] as DailyReport[],
        {
          data: [
            {
              date: '2015/01/01',
              categories: [
                { category: 'Pain', rank: 2 },
                { category: 'Mood', rank: 1 },
              ],
            },
            {
              date: '2015/01/02',
              categories: [
                { category: 'Appetite', rank: 2 },
                { category: 'Mood', rank: 1 },
              ],
            },
            {
              date: '2015/01/03',
              categories: [
                { category: 'Pain', rank: 2 },
                { category: 'Mobility', rank: 1 },
              ],
            },
          ],
          metadata: { minDate: '2015/01/01' },
        },
      ],
      [
        'invalid start/end dates - will result in an empty start date from the date calculator',
        null,
        null,
        {
          data: null,
          metadata: { minDate: null },
        },
      ],
    ])('%s', async (message, oldestDailyReportRecord, serviceGetDailyReports, expectedResult) => {
      jest.spyOn(service, 'getOldestDailyReportRecord').mockResolvedValue(oldestDailyReportRecord);
      jest.spyOn(service, 'getDailyReports').mockResolvedValue(serviceGetDailyReports);
      expect(
        await resolver.getDailyReports([MemberRole.member], {} as DailyReportQueryInput),
      ).toEqual(expectedResult);
    });
  });
});
