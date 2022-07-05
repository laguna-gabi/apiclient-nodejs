import { LogInternalKey, generateDispatchId } from '@argus/irisClient';
import {
  NotificationType,
  generateId,
  generateObjectId,
  mockLogger,
  mockProcessWarnings,
} from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { checkDelete, dbDisconnect, defaultModules } from '..';
import { EventType, IEventDeleteMember, LoggerService } from '../../src/common';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportDocument,
  DailyReportModule,
  DailyReportService,
} from '../../src/dailyReport';
import { JourneyService } from '../../src/journey';
import { MemberService } from '../../src/member';

describe('DailyReportCategoryService', () => {
  let module: TestingModule;
  let service: DailyReportService;

  let memberService: MemberService;
  let journeyService: JourneyService;
  let eventEmitter: EventEmitter2;

  let spyOnMemberServiceGet: jest.SpyInstance;
  let spyOnJourneyServiceGetRecent: jest.SpyInstance;
  let spyOnEventEmitterEmit: jest.SpyInstance;
  let spyOnDailyReportModelFindOneAndUpdate: jest.SpyInstance;

  let dailyReportModel: Model<DailyReport>;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(DailyReportModule),
    }).compile();

    service = module.get<DailyReportService>(DailyReportService);
    dailyReportModel = module.get<Model<DailyReport>>(getModelToken(DailyReport.name));

    mockLogger(module.get<LoggerService>(LoggerService));
    memberService = module.get<MemberService>(MemberService);
    journeyService = module.get<JourneyService>(JourneyService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    spyOnMemberServiceGet = jest.spyOn(memberService, 'get');
    spyOnJourneyServiceGetRecent = jest.spyOn(journeyService, 'getRecent');
    spyOnEventEmitterEmit = jest.spyOn(eventEmitter, 'emit');
    spyOnDailyReportModelFindOneAndUpdate = jest.spyOn(dailyReportModel, 'findOneAndUpdate');
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('get', () => {
    it(`find repo method to be called with expected parameters`, async () => {
      const memberId = generateId();
      const journeyId = generateId();
      const spyOnMockDailyReportCategoryModel = jest
        .spyOn(dailyReportModel, 'find')
        .mockReturnValueOnce(undefined);
      await service.get({ memberId, journeyId, startDate: '2020/01/01', endDate: '2020/01/02' });
      expect(spyOnMockDailyReportCategoryModel).toBeCalledWith({
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
        date: {
          $gte: '2020/01/01',
          $lte: '2020/01/02',
        },
      });
    });
  });

  describe('setDailyReportCategories', () => {
    const memberId = generateId();
    const primaryUserId = generateId();
    const recentJourneyId = generateId();

    beforeAll(async () => {
      spyOnMemberServiceGet.mockResolvedValue({ primaryUserId });
      spyOnJourneyServiceGetRecent.mockResolvedValue({ id: recentJourneyId });
    });

    beforeEach(() => {
      spyOnEventEmitterEmit.mockReset();
      spyOnDailyReportModelFindOneAndUpdate.mockReset();
    });

    it.each([
      [
        'new daily record - stats under threshold',
        {
          date: '2015/01/01',
          categories: [{ rank: 4, category: DailyReportCategoryTypes.Pain }],
          memberId,
          journeyId: recentJourneyId,
        } as DailyReportCategoriesInput, // <= new record
        null, // <= no existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
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
          journeyId: recentJourneyId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
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
          journeyId: recentJourneyId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
          categories: [{ rank: 4, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
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
          journeyId: recentJourneyId,
        } as DailyReportCategoriesInput, // <= new record
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
          categories: [{ rank: 3, category: DailyReportCategoryTypes.Pain }],
        } as DailyReportDocument, // <= existing record in db
        {
          date: '2015/01/01',
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(recentJourneyId),
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

        await service.setDailyReportCategories(dailyReportCategoryEntry);

        expect(spyOnDailyReportModelFindOneAndUpdate).toHaveBeenCalledWith(
          {
            date: dailyReportCategoryEntry.date,
            journeyId: new Types.ObjectId(recentJourneyId),
            memberId: new Types.ObjectId(memberId),
          },
          {
            ...expectedDailyReport,
            deleted: false,
            notificationSent: expectedDailyReport.statsOverThreshold?.length ? true : undefined,
          },
          { new: true, upsert: true },
        );

        let nthCallForNotifyDeleteDispatch = 1;
        if (expectedDailyReport.statsOverThreshold?.length) {
          expect(spyOnEventEmitterEmit).toHaveBeenNthCalledWith(
            1,
            EventType.notifyDispatch,
            expect.objectContaining({
              notificationType: NotificationType.textSms,
              recipientClientId: primaryUserId.toString(),
              senderClientId: dailyReportCategoryEntry.memberId,
              contentKey: LogInternalKey.memberNotFeelingWellMessage,
            }),
          );
          nthCallForNotifyDeleteDispatch++;
        }

        if (
          expectedDailyReport.statsOverThreshold.find(
            (stat) => stat === DailyReportCategoryTypes.Pain,
          )
        ) {
          expect(spyOnEventEmitterEmit).toHaveBeenNthCalledWith(
            nthCallForNotifyDeleteDispatch,
            EventType.onHighPainScoreIndication,
            expect.objectContaining({
              memberId,
            }),
          );
          nthCallForNotifyDeleteDispatch++;
        }

        expect(spyOnEventEmitterEmit).toHaveBeenNthCalledWith(
          nthCallForNotifyDeleteDispatch,
          EventType.notifyDeleteDispatch,
          {
            dispatchId: generateDispatchId(
              LogInternalKey.logReminder,
              dailyReportCategoryEntry.memberId,
            ),
          },
        );
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

  describe('getDailyReports', () => {
    it(`to return an empty list if parameters has invalid dates`, async () => {
      expect(
        await service.getDailyReports({
          memberId: generateId(),
          journeyId: generateId(),
          startDate: '2020/01/10',
          endDate: '2020/01/09',
        }),
      ).toEqual([]);
    });

    it(`to return a non-empty list`, async () => {
      const memberId = generateObjectId();
      const journeyId = generateObjectId();
      jest.spyOn(service, 'get').mockResolvedValue([
        {
          memberId,
          journeyId,
          date: '2020/01/09',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      ]);
      expect(
        await service.getDailyReports({
          memberId: generateId(),
          journeyId: generateId(),
          startDate: '2020/01/09',
          endDate: '2020/01/10',
        }),
      ).toEqual([
        {
          memberId,
          journeyId,
          date: '2020/01/09',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      ]);
    });
  });

  describe('deleteMemberDailyReports', () => {
    test.each([true, false])(`should delete members daily report`, async (hard) => {
      const memberId = generateId();
      const journeyId = generateId();
      const deletedBy = generateId();
      const dailyReport: DailyReport = {
        date: '2015/01/01',
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
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
      const journeyId = generateId();
      const deletedBy = generateId();
      const dailyReport: DailyReport = {
        date: '2015/01/01',
        memberId: new Types.ObjectId(memberId),
        journeyId: new Types.ObjectId(journeyId),
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
