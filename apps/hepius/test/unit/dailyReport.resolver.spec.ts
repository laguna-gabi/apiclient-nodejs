import { MemberRole } from '@argus/hepiusClient';
import { LogInternalKey, generateDispatchId } from '@argus/irisClient';
import { NotificationType, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { dbDisconnect, defaultModules, generateId } from '..';
import { EventType, LoggerService } from '../../src/common';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategory,
  DailyReportCategoryTypes,
  DailyReportModule,
  DailyReportQueryInput,
  DailyReportResolver,
  DailyReportService,
} from '../../src/dailyReport';

describe('DailyReportResolver', () => {
  let resolver: DailyReportResolver;
  let service: DailyReportService;
  let eventEmitter: EventEmitter2;
  let module: TestingModule;
  let memberId: string;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      providers: [DailyReportResolver, LoggerService],
      imports: defaultModules().concat(DailyReportModule),
    }).compile();

    resolver = module.get<DailyReportResolver>(DailyReportResolver);
    service = module.get<DailyReportService>(DailyReportService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    mockLogger(module.get<LoggerService>(LoggerService));

    memberId = generateId();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('setDailyReportCategories', () => {
    let eventEmitterSpy;

    afterEach(() => {
      eventEmitterSpy.mockReset();
    });
    memberId = generateId();

    /* eslint-disable max-len */
    it.each([
      [
        'expect to emit notification - no stats-over-threshold',
        {
          statsOverThreshold: [DailyReportCategoryTypes.Pain], // <= single stat over threshold
          memberId: new Types.ObjectId(memberId),
          categories: [],
          date: '2015/01/01',
        } as DailyReport, // <= daily report returned from service (updated record),
        {
          honorific: 'Mr.',
          lastName: 'Levy',
          primaryUserId: 'U0001',
          roles: [MemberRole.member],
        }, // <= context
        {
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
          memberId,
        } as DailyReportCategoriesInput, // <= input to setDailyReportCategory method
        {
          contentKey: LogInternalKey.memberNotFeelingWellMessage,
          notificationType: NotificationType.textSms,
          recipientClientId: 'U0001',
          senderClientId: memberId,
        },
      ],
      [
        'expect not to emit notification - no stats-over-threshold',
        {
          statsOverThreshold: [], // <= no stats over threshold
          memberId: new Types.ObjectId(memberId),
          categories: [],
          date: '2015/01/01',
        } as DailyReport, // <= daily report returned from service (updated record),
        {
          honorific: 'Mr.',
          lastName: 'Levy',
          primaryUserId: 'U0001',
          roles: [MemberRole.member],
        }, // <= context
        {
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
          memberId,
        } as DailyReportCategoriesInput, // <= input to setDailyReportCategory method
        null,
      ],
      [
        'expect to emit notification - no user info in request (context)',
        {
          statsOverThreshold: [DailyReportCategoryTypes.Pain], // <= single stat over threshold
          memberId: new Types.ObjectId(memberId),
          categories: [],
          date: '2015/01/01',
        } as DailyReport, // <= daily report returned from service (updated record),
        {
          honorific: 'Mr.',
          lastName: 'Levy',
          roles: [MemberRole.member],
          primaryUserId: undefined,
        }, // <= context (missing primary user id)
        {
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
          memberId,
        } as DailyReportCategoriesInput, // <= input to setDailyReportCategory method
        null,
      ],
    ])(
      '%s',
      async (
        _,
        serviceSetDailyReportCategoryReturnedValue,
        context,
        dailyReportCategoryInput,
        emittedEventParams,
      ) => {
        /* eslint-enable max-len */
        jest
          .spyOn(service, 'setDailyReportCategories')
          .mockResolvedValue(serviceSetDailyReportCategoryReturnedValue);
        eventEmitterSpy = jest.spyOn(eventEmitter, 'emit');
        await resolver.setDailyReportCategories(
          context.roles,
          context.primaryUserId,
          dailyReportCategoryInput,
        );
        const params = {
          dispatchId: generateDispatchId(
            LogInternalKey.logReminder,
            dailyReportCategoryInput.memberId,
          ),
        };
        if (emittedEventParams) {
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            1,
            EventType.notifyDispatch,
            expect.objectContaining(emittedEventParams),
          );
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            2,
            EventType.notifyDeleteDispatch,
            params,
          );
        } else {
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            1,
            EventType.notifyDeleteDispatch,
            params,
          );
        }
      },
    );
  });

  describe('getDailyReports', () => {
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
