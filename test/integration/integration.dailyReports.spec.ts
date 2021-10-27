import {
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportQueryInput,
} from '../../src/dailyReport';
import { Handler } from '../aux/handler';

describe('Integration tests : Daily Reports Module', () => {
  const handler: Handler = new Handler();
  let patientZeroId: string;

  beforeAll(async () => {
    await handler.beforeAll(false);
    patientZeroId = handler.patientZero.id.toString();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('patient-zero set/get a daily report', async () => {
    const { updatedDailyReport } = await handler
      .setContextUser(undefined, handler.patientZero.authId)
      .mutations.setDailyReportCategories({
        dailyReportCategoriesInput: {
          date: '2015/01/01',
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          memberId: patientZeroId,
        } as DailyReportCategoriesInput,
      });
    console.log(JSON.stringify(updatedDailyReport));
    expect(updatedDailyReport).toEqual({
      categories: [{ rank: 1, category: 'Pain' }],
      memberId: patientZeroId,
      date: '2015/01/01',
      statsOverThreshold: null,
    });

    const { dailyReports } = await handler
      .setContextUser(undefined, handler.patientZero.authId)
      .queries.getDailyReports({
        dailyReportQueryInput: {
          startDate: '2015/01/01',
          endDate: '2015/01/01',
          memberId: patientZeroId,
        } as DailyReportQueryInput,
      });

    expect(dailyReports).toEqual({
      data: [
        {
          categories: [{ category: 'Pain', rank: 1 }],
          date: '2015/01/01',
          statsOverThreshold: null,
          memberId: patientZeroId,
        },
      ],
      metadata: { minDate: '2015/01/01' },
    });
  });
});
