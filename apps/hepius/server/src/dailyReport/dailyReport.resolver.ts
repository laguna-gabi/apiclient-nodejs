import { MemberRole, UserRole } from '@argus/hepiusClient';
import { LogInternalKey, generateDispatchId } from '@argus/irisClient';
import { EntityName, NotificationType } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportQueryInput,
  DailyReportResults,
  DailyReportService,
  ParseDailyReportInputTransform,
} from '.';
import {
  Ace,
  Client,
  EventType,
  IInternalDispatch,
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  Roles,
  getCorrelationId,
} from '../common';
import { JourneyService } from '../journey';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class DailyReportResolver {
  constructor(
    private readonly dailyReportService: DailyReportService,
    private readonly journeyService: JourneyService,
    readonly eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
  ) {}

  @Mutation(() => DailyReport)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async setDailyReportCategories(
    @Client('roles') roles,
    @Client('primaryUserId') primaryUserId,
    @Args(
      camelCase(DailyReportCategoriesInput.name),
      { type: () => DailyReportCategoriesInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportCategoriesInput: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    const recentJourney = await this.journeyService.getRecent(dailyReportCategoriesInput.memberId);
    const dailyReportObject = await this.dailyReportService.setDailyReportCategories({
      ...dailyReportCategoriesInput,
      journeyId: recentJourney.id,
    });

    if (
      primaryUserId &&
      dailyReportObject.statsOverThreshold?.length > 0 &&
      !dailyReportObject.notificationSent
    ) {
      const contentKey = LogInternalKey.memberNotFeelingWellMessage;
      const memberNotFeelingWellEvent: IInternalDispatch = {
        correlationId: getCorrelationId(this.logger),
        dispatchId: generateDispatchId(
          contentKey,
          primaryUserId,
          dailyReportCategoriesInput.memberId,
          Date.now().toString(),
        ),
        notificationType: NotificationType.textSms,
        recipientClientId: primaryUserId,
        senderClientId: dailyReportCategoriesInput.memberId,
        contentKey,
      };
      this.eventEmitter.emit(EventType.notifyDispatch, memberNotFeelingWellEvent);

      this.dailyReportService.logMemberOverThresholdIndication(dailyReportCategoriesInput.memberId);

      await this.dailyReportService.setNotificationIndication(
        dailyReportCategoriesInput.memberId,
        recentJourney.id,
        dailyReportCategoriesInput.date,
      );
    }
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(
        LogInternalKey.logReminder,
        dailyReportCategoriesInput.memberId,
      ),
    });

    return dailyReportObject;
  }

  @Query(() => DailyReportResults)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, MemberRole.member)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getDailyReports(
    @Client('roles') roles,
    @Args(
      camelCase(DailyReportQueryInput.name),
      { type: () => DailyReportQueryInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportQueryInput: DailyReportQueryInput,
  ): Promise<DailyReportResults> {
    try {
      const recentJourney = await this.journeyService.getRecent(dailyReportQueryInput.memberId);
      return {
        data: await this.dailyReportService.getDailyReports({
          ...dailyReportQueryInput,
          journeyId: recentJourney.id,
        }),
        metadata: {
          minDate: await this.dailyReportService.getOldestDailyReportRecord(recentJourney.id),
        },
      };
    } catch (ex) {
      return { data: [] };
    }
  }
}
