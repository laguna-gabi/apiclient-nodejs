import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { format, sub } from 'date-fns';
import { Model, Types } from 'mongoose';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportDocument,
  DailyReportQueryInput,
  DailyReportsMetadata,
} from '.';
import { BaseService, EventType, IEventDeleteMember, LoggerService } from '../common';
import { formatEx } from '@lagunahealth/pandora';

@Injectable()
export class DailyReportService extends BaseService {
  constructor(
    @InjectModel(DailyReport.name)
    private readonly dailyReport: Model<DailyReportDocument>,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async get(dailyReportCategoryQueryInput: DailyReportQueryInput): Promise<DailyReport[]> {
    return this.dailyReport
      .find({
        memberId: new Types.ObjectId(dailyReportCategoryQueryInput.memberId),
        date: {
          $gte: dailyReportCategoryQueryInput.startDate,
          $lte: dailyReportCategoryQueryInput.endDate,
        },
      })
      ?.sort({ date: 1 });
  }

  async setDailyReportCategories(
    dailyReportCategoryEntry: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    let dbObject: DailyReport = await this.dailyReport.findOne({
      memberId: Types.ObjectId(dailyReportCategoryEntry.memberId),
      date: dailyReportCategoryEntry.date,
    });

    if (!dbObject) {
      // init object if one does not exist already in db
      dbObject = {
        date: dailyReportCategoryEntry.date,
        memberId: new Types.ObjectId(dailyReportCategoryEntry.memberId),
        categories: [],
      };
    }

    dailyReportCategoryEntry?.categories.forEach((categoryEntry) => {
      // Make sure to keep the internal `categories` array with unique single entry per category
      const index = dbObject.categories?.findIndex(
        (entry) => entry.category === categoryEntry.category,
      );

      if (index >= 0) {
        dbObject.categories.splice(index, 1);
      }

      dbObject.categories?.push({
        rank: categoryEntry.rank,
        category: categoryEntry.category,
      });
    });

    // Description: to determine if a member is feeling well on a day (date) we check daily
    // reports from the last 3 consecutive days
    // step 1: get the daily reports from the last 2 days (prior to today)
    const recentDailyReports = await this.get({
      endDate: format(
        sub(Date.parse(dailyReportCategoryEntry.date), { days: 1 }),
        config.get('general.dateFormatString'),
      ),
      startDate: format(
        sub(Date.parse(dailyReportCategoryEntry.date), {
          days: config.get('dailyReport.thresholdIndicator') - 1,
        }),
        config.get('general.dateFormatString'),
      ),
      memberId: dailyReportCategoryEntry.memberId,
    });

    // step 2: add the updated record from today
    recentDailyReports.push(dbObject);

    // step 3: calculate stats over threshold
    dbObject.statsOverThreshold = this.getStatsOverThreshold(recentDailyReports);

    await this.dailyReport.findOneAndUpdate(
      {
        memberId: Types.ObjectId(dailyReportCategoryEntry.memberId),
        date: dailyReportCategoryEntry.date,
      },
      dbObject,
      {
        upsert: true,
        new: true,
      },
    );

    return dbObject;
  }

  getStatsOverThreshold(records: DailyReport[]): DailyReportCategoryTypes[] {
    const stats: Record<string, number> = {};

    // calculate:
    records.forEach((dailyRecord: DailyReport) => {
      dailyRecord.categories.forEach((record) => {
        const metadata = DailyReportsMetadata.get(record.category as DailyReportCategoryTypes);
        if (metadata.threshold >= record.rank) {
          stats[record.category] ? stats[record.category]++ : (stats[record.category] = 1);
        }
      });
    });

    const statsOverThreshold: Array<DailyReportCategoryTypes> = [];

    for (const category in DailyReportCategoryTypes) {
      if (
        !DailyReportsMetadata.get(category as DailyReportCategoryTypes).disabled &&
        stats[category] == config.get('dailyReport.thresholdIndicator')
      ) {
        statsOverThreshold.push(category as DailyReportCategoryTypes);
      }
    }

    return statsOverThreshold.length ? statsOverThreshold : undefined;
  }

  // Description: fetch date of oldest daily report record for member
  async getOldestDailyReportRecord(memberId: string): Promise<string> {
    const oldestRecord: DailyReport[] = await this.dailyReport.aggregate([
      { $match: { memberId: new Types.ObjectId(memberId) } },
      { $sort: { date: 1 } },
      { $limit: 1 },
      { $project: { date: 1 } },
    ]);

    if (oldestRecord.length > 0) {
      return oldestRecord[0].date;
    }

    return null;
  }

  async getDailyReports(dailyReportQueryInput: DailyReportQueryInput): Promise<DailyReport[]> {
    // no records to show - client requested a start date too far in the past
    if (Date.parse(dailyReportQueryInput.endDate) < Date.parse(dailyReportQueryInput.startDate)) {
      return [];
    }

    return this.get(dailyReportQueryInput);
  }
  // Description: to indicate that a notification was sent to primary user due to
  //              indications that the member (with memberId) is not feeling well
  async setNotificationIndication(memberId: string, date: string) {
    return this.dailyReport.updateOne(
      {
        memberId: new Types.ObjectId(memberId),
        date,
      },
      { $set: { notificationSent: true } },
    );
  }

  logMemberOverThresholdIndication(memberId: string) {
    this.logger.info(
      { memberId },
      DailyReportService.name,
      this.logMemberOverThresholdIndication.name,
    );
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberDailyReports(params: IEventDeleteMember) {
    this.logger.info(params, DailyReportService.name, this.deleteMemberDailyReports.name);
    const { memberId, hard } = params;
    try {
      if (hard) {
        await this.dailyReport.deleteMany({ memberId: new Types.ObjectId(memberId) });
      }
      // todo: add soft delete
    } catch (ex) {
      this.logger.error(
        params,
        DailyReportService.name,
        this.deleteMemberDailyReports.name,
        formatEx(ex),
      );
    }
  }
}
