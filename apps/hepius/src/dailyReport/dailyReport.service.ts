import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportDocument,
  DailyReportQueryInput,
  DailyReportsMetadata,
} from '.';
import {
  BaseService,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';

@Injectable()
export class DailyReportService extends BaseService {
  constructor(
    @InjectModel(DailyReport.name)
    private readonly dailyReportModel: Model<DailyReportDocument> &
      ISoftDelete<DailyReportDocument>,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async get(dailyReportCategoryQueryInput: DailyReportQueryInput): Promise<DailyReport[]> {
    return this.dailyReportModel
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
    let dailyReportRecord: DailyReport = await this.dailyReportModel.findOne({
      memberId: new Types.ObjectId(dailyReportCategoryEntry.memberId),
      date: dailyReportCategoryEntry.date,
    });

    if (!dailyReportRecord) {
      // init object if one does not exist already in db
      dailyReportRecord = {
        date: dailyReportCategoryEntry.date,
        memberId: new Types.ObjectId(dailyReportCategoryEntry.memberId),
        categories: [],
      };
    }

    dailyReportCategoryEntry?.categories.forEach((categoryEntry) => {
      // Make sure to keep the internal `categories` array with unique single entry per category
      const index = dailyReportRecord.categories?.findIndex(
        (entry) => entry.category === categoryEntry.category,
      );

      if (index >= 0) {
        dailyReportRecord.categories.splice(index, 1);
      }

      dailyReportRecord.categories?.push({
        rank: categoryEntry.rank,
        category: categoryEntry.category,
      });
    });

    // calculate stats over threshold: any category compared to a pre-defined threshold
    dailyReportRecord.statsOverThreshold = dailyReportRecord.categories
      .filter((entry) => entry.rank <= DailyReportsMetadata.get(entry.category).threshold)
      .map((entry) => entry.category);

    await this.dailyReportModel.findOneAndUpdate(
      {
        memberId: new Types.ObjectId(dailyReportCategoryEntry.memberId),
        date: dailyReportCategoryEntry.date,
      },
      { ...dailyReportRecord, deleted: false },
      {
        upsert: true,
        new: true,
      },
    );

    return dailyReportRecord;
  }

  // Description: fetch date of oldest daily report record for member
  async getOldestDailyReportRecord(memberId: string): Promise<string> {
    const oldestRecord: DailyReport[] = await this.dailyReportModel.aggregate([
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
    return this.dailyReportModel.updateOne(
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
    await deleteMemberObjects<Model<DailyReportDocument> & ISoftDelete<DailyReportDocument>>({
      params,
      model: this.dailyReportModel,
      logger: this.logger,
      methodName: this.deleteMemberDailyReports.name,
      serviceName: DailyReportService.name,
    });
  }
}
