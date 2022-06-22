import { LogInternalKey, generateDispatchId } from '@argus/irisClient';
import { NotificationType } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { format, utcToZonedTime } from 'date-fns-tz';
import { Model, Types } from 'mongoose';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportCategory,
  DailyReportDocument,
  DailyReportQueryInput,
  DailyReportsMetadata,
} from '.';
import {
  BaseService,
  EventType,
  IEventDeleteMember,
  IEventOnQRSubmit,
  IInternalDispatch,
  LoggerService,
  deleteMemberObjects,
  getCorrelationId,
  momentFormats,
} from '../common';
import { ISoftDelete } from '../db';
import { JourneyService } from '../journey';
import { MemberService } from '../member';
import { QuestionnaireType } from '../questionnaire';
import { lookup } from 'zipcode-to-timezone';

@Injectable()
export class DailyReportService extends BaseService {
  constructor(
    @InjectModel(DailyReport.name)
    private readonly dailyReportModel: Model<DailyReportDocument> &
      ISoftDelete<DailyReportDocument>,
    private readonly logger: LoggerService,
    private readonly journeyService: JourneyService,
    readonly eventEmitter: EventEmitter2,
    readonly memberService: MemberService,
  ) {
    super();
  }

  async get(dailyReportCategoryQueryInput: DailyReportQueryInput): Promise<DailyReport[]> {
    return this.dailyReportModel
      .find({
        memberId: new Types.ObjectId(dailyReportCategoryQueryInput.memberId),
        journeyId: new Types.ObjectId(dailyReportCategoryQueryInput.journeyId),
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
    const { primaryUserId } = await this.memberService.get(dailyReportCategoryEntry.memberId);
    const { id: recentJourneyId } = await this.journeyService.getRecent(
      dailyReportCategoryEntry.memberId,
    );

    const filterParams = {
      memberId: new Types.ObjectId(dailyReportCategoryEntry.memberId),
      journeyId: new Types.ObjectId(recentJourneyId),
      date: dailyReportCategoryEntry.date,
    };

    let dailyReportRecord: DailyReport = await this.dailyReportModel.findOne(filterParams);
    dailyReportRecord = dailyReportRecord || { ...filterParams, categories: [] };

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

    if (
      primaryUserId &&
      dailyReportRecord.statsOverThreshold?.length > 0 &&
      !dailyReportRecord.notificationSent
    ) {
      const contentKey = LogInternalKey.memberNotFeelingWellMessage;
      const memberNotFeelingWellEvent: IInternalDispatch = {
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(
          contentKey,
          primaryUserId.toString(),
          dailyReportCategoryEntry.memberId,
          Date.now().toString(),
        ),
        notificationType: NotificationType.textSms,
        recipientClientId: primaryUserId.toString(),
        senderClientId: dailyReportCategoryEntry.memberId,
        contentKey,
      };
      this.eventEmitter.emit(EventType.notifyDispatch, memberNotFeelingWellEvent);

      this.logMemberOverThresholdIndication(dailyReportCategoryEntry.memberId);

      // to indicate that a notification was sent to primary (avoid sending more than once)
      dailyReportRecord.notificationSent = true;
    }

    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(LogInternalKey.logReminder, dailyReportCategoryEntry.memberId),
    });

    return this.dailyReportModel.findOneAndUpdate(
      filterParams,
      { ...dailyReportRecord, deleted: false },
      {
        upsert: true,
        new: true,
      },
    );
  }

  // Description: fetch date of oldest daily report record for member
  async getOldestDailyReportRecord(journeyId: string): Promise<string> {
    const oldestRecord: DailyReport[] = await this.dailyReportModel.aggregate([
      { $match: { journeyId: new Types.ObjectId(journeyId) } },
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

  @OnEvent(EventType.onQRSubmit, { async: true })
  async handleMemberDailyReportQRSubmit(params: IEventOnQRSubmit) {
    const member = await this.memberService.get(params.memberId);
    if (params.questionnaireType === QuestionnaireType.mdl) {
      await this.setDailyReportCategories({
        memberId: params.memberId,
        journeyId: params.journeyId,
        date: format(utcToZonedTime(Date.now(), lookup(member.zipCode)), momentFormats.date),
        categories: params.questionnaireResponse.answers.map(
          (answer) =>
            ({
              category: answer.code,
              rank: +answer.value,
            } as DailyReportCategory),
        ),
      });
    }
  }
}
