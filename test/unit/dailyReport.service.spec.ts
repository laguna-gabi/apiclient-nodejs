import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { IEventDeleteMember, LoggerService } from '../../src/common';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportDocument,
  DailyReportModule,
  DailyReportService,
} from '../../src/dailyReport';
import { dbDisconnect, defaultModules, generateId, generateObjectId } from '../index';

describe('DailyReportCategoryService', () => {
  let service: DailyReportService;
  let dailyReportModel: Model<DailyReport>;
  let module: TestingModule;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(DailyReportModule),
    }).compile();

    service = module.get<DailyReportService>(DailyReportService);
    dailyReportModel = module.get<Model<DailyReport>>(getModelToken(DailyReport.name));

    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get', () => {
    it(`find repo method to be called with expected parameters`, async () => {
      const memberId = generateId();
      const spyOnMockDailyReportCategoryModel = jest
        .spyOn(dailyReportModel, 'find')
        .mockReturnValueOnce(undefined);
      await service.get({ memberId, startDate: '2020/01/01', endDate: '2020/01/02' });
      expect(spyOnMockDailyReportCategoryModel).toBeCalledWith({
        memberId: new Types.ObjectId(memberId),
        date: {
          $gte: '2020/01/01',
          $lte: '2020/01/02',
        },
      });
    });
  });

  describe('setDailyReportCategories', () => {
    const memberId = generateId();

    it.each([
      [
        'new daily record generated',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 3 }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record(s)
        null, // <= no existing record in db
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: 'Pain' }],
        }, // <= expected
      ],
      [
        'update daily record - adding new category',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Mobility, rank: 2 }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record(s)
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: 'Pain' }],
        } as DailyReportDocument, // <= existing record in db
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [
            { rank: 3, category: 'Pain' },
            { rank: 2, category: 'Mobility' },
          ],
        }, // <= expected
      ],
      [
        'update daily record - update rank for existing category',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record(s)
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
        }, // <= expected
      ],
      [
        'history of member stats will result in a stats-over-record update',
        {
          date: '2015-01-05',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 3 }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record(s)
        {
          date: '2015/01/05',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        [
          {
            date: '2015//04',
            memberId: Types.ObjectId(memberId),
            categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
          },
          {
            date: '2015//03',
            memberId: Types.ObjectId(memberId),
            categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
          },
        ], // <= recent daily reports in db
        {
          date: '2015/01/05',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
          statsOverThreshold: [DailyReportCategoryTypes.Pain],
        }, // <= expected
      ],
      [
        'update daily record - update rank for existing category and introduce a new category',
        {
          date: '2015/01/01',
          categories: [
            { category: DailyReportCategoryTypes.Pain, rank: 1 },
            { category: DailyReportCategoryTypes.Mobility, rank: 1 },
          ],
          memberId,
        } as DailyReportCategoriesInput, // <= new record(s)
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [
            { rank: 1, category: DailyReportCategoryTypes.Pain },
            { rank: 1, category: DailyReportCategoryTypes.Mobility },
          ],
          statsOverThreshold: undefined,
        }, // <= expected
      ],
    ])(
      `%s`,
      async (
        message,
        // Input to service method - new category entry to set/update
        dailyReportCategoryEntry,
        // current daily report stored in db (could be empty on first set/update)
        existingRecordInDatabase,
        // daily reports of the last 2 days (for stats-over-threshold calculation)
        getRecentDailyReportsReturnedValue,
        expectedDailyReport,
      ) => {
        jest.spyOn(dailyReportModel, 'findOne').mockResolvedValue(existingRecordInDatabase);

        jest.spyOn(dailyReportModel, 'findOneAndUpdate').mockResolvedValue(null);

        jest.spyOn(service, 'get').mockResolvedValue(getRecentDailyReportsReturnedValue);

        const out = await service.setDailyReportCategories(dailyReportCategoryEntry);

        expect(out).toEqual(expectedDailyReport);
      },
    );
  });

  describe('getStatsOverThreshold', () => {
    it.each([
      [
        "member stats from the last 3 days indicate that he's not feeling well in some categories",
        [
          {
            categories: [
              { category: 'Mobility', rank: 1 },
              { category: 'Appetite', rank: 1 },
            ],
            date: '2020/01/01',
          } as DailyReport,
          {
            categories: [
              { category: 'Mobility', rank: 2 },
              { category: 'Appetite', rank: 1 },
            ],
            date: '2020/01/02',
          } as DailyReport,
          {
            categories: [
              { category: 'Mobility', rank: 2 },
              { category: 'Appetite', rank: 2 },
            ],
            date: '2020/01/03',
          } as DailyReport,
        ],
        [DailyReportCategoryTypes.Appetite, DailyReportCategoryTypes.Mobility],
      ],
      [
        "member stats from the last 3 days indicate that he's feeling well in all categories",
        [
          {
            categories: [
              { category: 'Pain', rank: 3 },
              { category: 'Mood', rank: 4 },
            ],
            date: '2020/01/01',
          } as DailyReport,
          {
            categories: [{ category: 'Mood', rank: 1 }],
            date: '2020/01/02',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 4 },
              { category: 'Mood', rank: 1 },
            ],
            date: '2020/01/03',
          } as DailyReport,
        ],
        undefined,
      ],
      [
        'member stats only from the last 2 days - will yield no categories over threshold',
        [
          {
            categories: [
              { category: 'Pain', rank: 1 },
              { category: 'Mood', rank: 1 },
            ],
            date: '2020/01/01',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 1 },
              { category: 'Mood', rank: 1 },
            ],
            date: '2020/01/02',
          } as DailyReport,
        ],
        undefined,
      ],
    ])(`%p`, async (message, records, expected) => {
      expect(await service.getStatsOverThreshold(records)?.sort()).toEqual(
        expected ? expected.sort() : undefined,
      );
    });
  });

  describe('getOldestDailyReportRecord', () => {
    it.each([
      ['valid old record in db', [{ date: '2020/01/03' }], '2020/01/03'],
      ['no valid old record in db', [], null],
    ])(`%s`, async (message, returnedAggregateValue, oldestRecordDate) => {
      jest.spyOn(dailyReportModel, 'aggregate').mockResolvedValue(returnedAggregateValue);

      const out = await service.getOldestDailyReportRecord(generateId());

      expect(out).toEqual(oldestRecordDate);
    });
  });

  describe('setNotificationIndication', () => {
    it(`model update should be called with the correct parameters`, () => {
      const spyOnDailyReportCategoryModel = jest
        .spyOn(dailyReportModel, 'updateOne')
        .mockResolvedValue(undefined);

      const memberId = generateId();

      service.setNotificationIndication(memberId, '2020/01/01');

      expect(spyOnDailyReportCategoryModel).toBeCalledWith(
        {
          memberId: new Types.ObjectId(memberId),
          date: '2020/01/01',
        },
        { $set: { notificationSent: true } },
      );
    });
  });

  describe('getDailyReports', () => {
    it(`to return an empty list if parameters has invalid dates`, async () => {
      expect(
        await service.getDailyReports({
          memberId: generateId(),
          startDate: '2020/01/10',
          endDate: '2020/01/09',
        }),
      ).toEqual([]);
    });

    it(`to return a non-empty list`, async () => {
      const memberId = generateObjectId();
      jest.spyOn(service, 'get').mockResolvedValue([
        {
          memberId,
          date: '2020/01/09',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      ]);
      expect(
        await service.getDailyReports({
          memberId: generateId(),
          startDate: '2020/01/09',
          endDate: '2020/01/10',
        }),
      ).toEqual([
        {
          memberId,
          date: '2020/01/09',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      ]);
    });
  });

  describe('deleteDailyReports', () => {
    it(`model deleteMany should be called with the correct parameters - hard delete`, async () => {
      const spyOnDailyReportCategoryModel = jest
        .spyOn(dailyReportModel, 'deleteMany')
        .mockResolvedValue(undefined);

      const memberId = generateId();

      const params: IEventDeleteMember = {
        memberId: memberId,
        deletedBy: generateId(),
        hard: true,
      };
      await service.deleteMemberDailyReports(params);

      expect(spyOnDailyReportCategoryModel).toBeCalledWith({
        memberId: new Types.ObjectId(memberId),
      });
    });
  });
});
