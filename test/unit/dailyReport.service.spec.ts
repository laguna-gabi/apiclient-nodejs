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
import { checkDelete, dbDisconnect, defaultModules, generateId, generateObjectId } from '../index';

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
        'new daily record - stats under threshold',
        {
          date: '2015/01/01',
          categories: [{ rank: 4, category: DailyReportCategoryTypes.Pain }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record
        null, // <= no existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [{ rank: 4, category: DailyReportCategoryTypes.Pain }],
          statsOverThreshold: [],
        }, // <= expected
      ],
      [
        'update daily record - adding new category (over threshold)',
        {
          date: '2015/01/01',
          categories: [
            { rank: 2, category: DailyReportCategoryTypes.Mobility },
            { rank: 4, category: DailyReportCategoryTypes.Pain },
          ],
          memberId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [
            { rank: 2, category: DailyReportCategoryTypes.Mobility },
            { rank: 4, category: DailyReportCategoryTypes.Pain },
          ],
          statsOverThreshold: [DailyReportCategoryTypes.Mobility],
        }, // <= expected
      ],
      [
        'update daily record - update rank for existing category (resulting in an over threshold)',
        {
          date: '2015/01/01',
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
          memberId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [{ rank: 4, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [{ rank: 1, category: DailyReportCategoryTypes.Pain }],
          statsOverThreshold: [DailyReportCategoryTypes.Pain],
        }, // <= expected
      ],
      [
        // eslint-disable-next-line max-len
        'update daily record - update rank for existing category and introduce a new category (both over threshold)',
        {
          date: '2015/01/01',
          categories: [
            { rank: 1, category: DailyReportCategoryTypes.Pain },
            { rank: 1, category: DailyReportCategoryTypes.Mobility },
          ],
          memberId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          categories: [
            { rank: 1, category: DailyReportCategoryTypes.Pain },
            { rank: 1, category: DailyReportCategoryTypes.Mobility },
          ],
          statsOverThreshold: [DailyReportCategoryTypes.Pain, DailyReportCategoryTypes.Mobility],
        }, // <= expected
      ],
    ])(
      `%s`,
      async (
        _,
        // Input to service method - new category entry to set/update
        dailyReportCategoryEntry,
        // current daily report stored in db (could be empty on first set/update)
        existingRecordInDatabase,
        expectedDailyReport,
      ) => {
        jest.spyOn(dailyReportModel, 'findOne').mockResolvedValueOnce(existingRecordInDatabase);

        jest.spyOn(dailyReportModel, 'findOneAndUpdate').mockResolvedValue(null);

        const out = await service.setDailyReportCategories(dailyReportCategoryEntry);

        expect(out).toEqual(expectedDailyReport);
      },
    );
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

  describe('deleteMemberDailyReports', () => {
    test.each([true, false])(`should delete members daily report`, async (hard) => {
      const memberId = generateId();
      const deletedBy = generateId();
      const dailyReport: DailyReport = {
        date: '2015/01/01',
        memberId: new Types.ObjectId(memberId),
        categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
      };
      await dailyReportModel.create(dailyReport);

      const params: IEventDeleteMember = {
        memberId: memberId,
        deletedBy,
        hard,
      };
      await service.deleteMemberDailyReports(params);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await dailyReportModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });

      if (hard) {
        expect(deletedResult).toEqual([]);
      } else {
        await checkDelete(deletedResult, { memberId: new Types.ObjectId(memberId) }, deletedBy);
      }
    });

    it(`should be able to hard delete after soft delete`, async () => {
      const memberId = generateId();
      const deletedBy = generateId();
      const dailyReport: DailyReport = {
        date: '2015/01/01',
        memberId: new Types.ObjectId(memberId),
        categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
      };
      await dailyReportModel.create(dailyReport);

      const params: IEventDeleteMember = {
        memberId: memberId,
        deletedBy,
        hard: false,
      };
      await service.deleteMemberDailyReports(params);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResult = await dailyReportModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      await checkDelete(deletedResult, { memberId: new Types.ObjectId(memberId) }, deletedBy);

      await service.deleteMemberDailyReports({ ...params, hard: true });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedResultHard = await dailyReportModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      expect(deletedResultHard).toEqual([]);
    });
  });
});
