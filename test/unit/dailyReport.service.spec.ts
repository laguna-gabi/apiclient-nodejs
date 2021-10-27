/* eslint-disable max-len */
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportService,
} from '../../src/dailyReport';
import { dbDisconnect, generateId } from '../../test';

describe('DailyReportCategoryService', () => {
  let service: DailyReportService;
  let mockDailyReportCategoryModel;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: getModelToken(DailyReport.name),
          useValue: Model,
        },
        DailyReportService,
      ],
    }).compile();

    service = module.get<DailyReportService>(DailyReportService);

    mockDailyReportCategoryModel = module.get<Model<DailyReport>>(getModelToken(DailyReport.name));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('check if member is feeling well', () => {
    it.each([
      [
        "member stats from the last 3 days indicate that he's not feeling well in all categories",
        [
          {
            categories: [
              { category: 'Pain', rank: 2 },
              { category: 'Mood', rank: 1 },
              { category: 'Sleep', rank: 1 },
              { category: 'Mobility', rank: 1 },
              { category: 'Appetite', rank: 1 },
              { category: 'Energy', rank: 1 },
            ],
            date: '2020/01/01',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 2 },
              { category: 'Mood', rank: 1 },
              { category: 'Sleep', rank: 1 },
              { category: 'Mobility', rank: 1 },
              { category: 'Appetite', rank: 1 },
              { category: 'Energy', rank: 1 },
            ],
            date: '2020/01/02',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 2 },
              { category: 'Mood', rank: 1 },
              { category: 'Sleep', rank: 1 },
              { category: 'Mobility', rank: 1 },
              { category: 'Appetite', rank: 1 },
              { category: 'Energy', rank: 1 },
            ],
            date: '2020/01/03',
          } as DailyReport,
        ],
        [
          DailyReportCategoryTypes.Mood,
          DailyReportCategoryTypes.Appetite,
          DailyReportCategoryTypes.Mobility,
          DailyReportCategoryTypes.Energy,
          DailyReportCategoryTypes.Pain,
          DailyReportCategoryTypes.Sleep,
        ],
        ,
      ],
      [
        "member stats from the last 3 days indicate that he's not feeling well in some categories",
        [
          {
            categories: [
              { category: 'Pain', rank: 3 },
              { category: 'Mood', rank: 2 },
              { category: 'Sleep', rank: 4 },
              { category: 'Mobility', rank: 1 },
              { category: 'Appetite', rank: 1 },
              { category: 'Energy', rank: 1 },
            ],
            date: '2020/01/01',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 2 },
              { category: 'Mood', rank: 1 },
              { category: 'Sleep', rank: 1 },
              { category: 'Mobility', rank: 2 },
              { category: 'Appetite', rank: 1 },
              { category: 'Energy', rank: 1 },
            ],
            date: '2020/01/02',
          } as DailyReport,
          {
            categories: [
              { category: 'Pain', rank: 3 },
              { category: 'Mood', rank: 1 },
              { category: 'Sleep', rank: 1 },
              { category: 'Mobility', rank: 2 },
              { category: 'Appetite', rank: 2 },
              { category: 'Energy', rank: 2 },
            ],
            date: '2020/01/03',
          } as DailyReport,
        ],
        [
          DailyReportCategoryTypes.Mood,
          DailyReportCategoryTypes.Appetite,
          DailyReportCategoryTypes.Mobility,
          DailyReportCategoryTypes.Pain,
        ],
      ],
    ])(`%p`, async (message, records, expected) => {
      expect(await service.getStatsOverThreshold(records).sort()).toEqual(expected.sort());
    });
  });

  describe('Test getOldestDailyReportRecord', () => {
    it.each([
      ['valid old record in db', [{ date: '2020/01/03' }], '2020/01/03'],
      ['valid old record in db', [], null],
    ])(`%s`, async (message, returnedAggregateValue, oldestRecordDate) => {
      jest
        .spyOn(mockDailyReportCategoryModel, 'aggregate')
        .mockResolvedValue(returnedAggregateValue);

      const out = await service.getOldestDailyReportRecord(generateId());

      expect(out).toEqual(oldestRecordDate);
    });
  });

  describe('Test getStatsOverThreshold', () => {
    it.each([
      [
        'empty list of daily reports should yield an empty stats-over-threshold array',
        [],
        undefined,
      ],
      [
        'some stats over threshold ',
        [
          {
            categories: [
              { category: DailyReportCategoryTypes.Pain, rank: 3 },
              { category: DailyReportCategoryTypes.Mobility, rank: 1 },
            ],
          } as DailyReport,
          {
            categories: [
              { category: DailyReportCategoryTypes.Mobility, rank: 1 },
              { category: DailyReportCategoryTypes.Pain, rank: 3 },
              { category: DailyReportCategoryTypes.Energy, rank: 1 },
            ],
          } as DailyReport,
          {
            categories: [
              { category: DailyReportCategoryTypes.Mobility, rank: 1 },
              { category: DailyReportCategoryTypes.Pain, rank: 3 },
              { category: DailyReportCategoryTypes.Energy, rank: 1 },
            ],
          } as DailyReport,
        ],
        [DailyReportCategoryTypes.Pain, DailyReportCategoryTypes.Mobility],
      ],
    ])(`%s`, async (message, dailyReports, expectedStatsOverThreshold) => {
      const out = await service.getStatsOverThreshold(dailyReports);

      expect(out).toEqual(expectedStatsOverThreshold);
    });
  });

  describe('Test setDailyReportCategory', () => {
    const memberId: string = generateId();

    it.each([
      [
        'new daily record generated',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 3 }],
          memberId,
        } as DailyReportCategoriesInput,
        null, // <= no existing record in db
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: 'Pain' }],
        },
      ],
      [
        'update daily record - adding new category',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Mobility, rank: 2 }],
          memberId,
        } as DailyReportCategoriesInput,
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: 'Pain' }],
        },
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [
            { rank: 3, category: 'Pain' },
            { rank: 2, category: 'Mobility' },
          ],
        },
      ],
      [
        'update daily record - update rank for existing category',
        {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          memberId,
        } as DailyReportCategoriesInput,
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        },
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
        },
      ],
      [
        'history of member stats will result in a stats-over-record update',
        {
          date: '2015-01-05',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 3 }],
          memberId,
        } as DailyReportCategoriesInput,
        {
          date: '2015/01/05',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
        },
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
        ], // <= no recent daily reports in db
        {
          date: '2015/01/05',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
          statsOverThreshold: [DailyReportCategoryTypes.Pain],
        },
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
        } as DailyReportCategoriesInput,
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        },
        [], // <= no recent daily reports in db
        {
          date: '2015/01/01',
          memberId: Types.ObjectId(memberId),
          categories: [
            { rank: 1, category: DailyReportCategoryTypes.Pain },
            { rank: 1, category: DailyReportCategoryTypes.Mobility },
          ],
          statsOverThreshold: undefined,
        },
      ],
    ])(
      `%s`,
      async (
        message,
        dailyReportCategoryEntry, // <= Input to service method - new category entry to set/update
        existingRecordInDatabase, // <= current daily report stored in db (could be empty on first set/update)
        getRecentDailyReportsReturnedValue, // <= daily reports of the last 2 days (for stats-over-threshold calculation)
        expectedDailyReport,
      ) => {
        jest
          .spyOn(mockDailyReportCategoryModel, 'findOne')
          .mockResolvedValue(existingRecordInDatabase);

        jest.spyOn(mockDailyReportCategoryModel, 'findOneAndUpdate').mockResolvedValue({});

        jest.spyOn(service, 'get').mockResolvedValue(getRecentDailyReportsReturnedValue);

        const out = await service.setDailyReportCategories(dailyReportCategoryEntry);

        expect(out).toEqual(expectedDailyReport);
      },
    );
  });
});
