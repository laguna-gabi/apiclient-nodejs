/* eslint-disable max-len */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ContentKey, EventType, IEventMember, Logger } from '../../src/common';
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
import { dbDisconnect, defaultModules, generateId } from '../index';
import { InternalNotificationType } from '@lagunahealth/pandora';

describe('DailyReportResolver', () => {
  let resolver: DailyReportResolver;
  let service: DailyReportService;
  let eventEmitter: EventEmitter2;
  let module: TestingModule;
  let memberId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [DailyReportResolver, Logger],
      imports: defaultModules().concat(DailyReportModule),
    }).compile();
    resolver = module.get<DailyReportResolver>(DailyReportResolver);
    service = module.get<DailyReportService>(DailyReportService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
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

    it.each([
      [
        'expect to emit notification - no stats-over-threshold',
        {
          statsOverThreshold: [DailyReportCategoryTypes.Pain], // <= single stat over threshold
          memberId: new Types.ObjectId(memberId),
          categories: [],
          date: '2015/01/01',
        } as DailyReport, // <= daily report returned from service (updated record),
        { req: { user: { honorific: 'Mr.', lastName: 'Levy', primaryUserId: 'U0001' } } }, // <= context
        {
          memberId: memberId,
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
        } as DailyReportCategoriesInput, // <= input to setDailyReportCategory method
        {
          memberId: memberId,
          metadata: {
            contentType: ContentKey.memberNotFeelingWellMessage,
          },
          type: InternalNotificationType.textSmsToUser,
          userId: 'U0001',
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
        { req: { user: { honorific: 'Mr.', lastName: 'Levy', primaryUserId: 'U0001' } } }, // <= context
        {
          memberId: memberId,
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
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
        { req: { user: { honorific: 'Mr.', lastName: 'Levy' } } }, // <= context (missing primary user id)
        {
          memberId: memberId,
          date: '',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 0 }],
        } as DailyReportCategoriesInput, // <= input to setDailyReportCategory method
        null,
      ],
    ])(
      '%s',
      async (
        message,
        serviceSetDailyReportCategoryReturnedValue,
        context,
        dailyReportCategoryInput,
        emittedEventParams,
      ) => {
        jest
          .spyOn(service, 'setDailyReportCategories')
          .mockResolvedValue(serviceSetDailyReportCategoryReturnedValue);
        eventEmitterSpy = jest.spyOn(eventEmitter, 'emit');
        await resolver.setDailyReportCategories(context, dailyReportCategoryInput);
        const eventParams: IEventMember = {
          memberId: dailyReportCategoryInput.memberId,
        };
        if (emittedEventParams) {
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            1,
            EventType.notifyInternal,
            emittedEventParams,
          );
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            2,
            EventType.onSetDailyLogCategories,
            eventParams,
          );
        } else {
          expect(eventEmitterSpy).toHaveBeenNthCalledWith(
            1,
            EventType.onSetDailyLogCategories,
            eventParams,
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

      expect(await resolver.getDailyReports({} as DailyReportQueryInput)).toEqual(expectedResult);
    });
  });
});
