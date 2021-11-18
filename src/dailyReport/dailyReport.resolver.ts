import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
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
  ContentKey,
  EventType,
  IEventMember,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
  RoleTypes,
  Roles,
} from '../common';
import { InternalNotificationType } from '@lagunahealth/pandora';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class DailyReportResolver {
  constructor(
    private readonly dailyReportService: DailyReportService,
    readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  @Roles(RoleTypes.Member, RoleTypes.User)
  @Mutation(() => DailyReport)
  async setDailyReportCategories(
    @Context() context,
    @Args(
      camelCase(DailyReportCategoriesInput.name),
      { type: () => DailyReportCategoriesInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportCategoriesInput: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    const dailyReportObject = await this.dailyReportService.setDailyReportCategories(
      dailyReportCategoriesInput,
    );

    if (
      context.req?.user?.primaryUserId &&
      dailyReportObject.statsOverThreshold?.length > 0 &&
      !dailyReportObject.notificationSent
    ) {
      const params: InternalNotifyParams = {
        memberId: dailyReportCategoriesInput.memberId,
        userId: context.req?.user?.primaryUserId,
        type: InternalNotificationType.textSmsToUser,
        metadata: { contentType: ContentKey.memberNotFeelingWellMessage },
      };

      this.eventEmitter.emit(EventType.notifyInternal, params);

      this.dailyReportService.logMemberOverThresholdIndication(dailyReportCategoriesInput.memberId);

      await this.dailyReportService.setNotificationIndication(
        dailyReportCategoriesInput.memberId,
        dailyReportCategoriesInput.date,
      );
    }
    const eventParam: IEventMember = {
      memberId: dailyReportCategoriesInput.memberId,
    };
    this.eventEmitter.emit(EventType.onSetDailyLogCategories, eventParam);

    return dailyReportObject;
  }

  @Roles(RoleTypes.Member, RoleTypes.User)
  @Query(() => DailyReportResults)
  async getDailyReports(
    @Args(
      camelCase(DailyReportQueryInput.name),
      { type: () => DailyReportQueryInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportQueryInput: DailyReportQueryInput,
  ): Promise<DailyReportResults> {
    return {
      data: await this.dailyReportService.getDailyReports(dailyReportQueryInput),
      metadata: {
        minDate: await this.dailyReportService.getOldestDailyReportRecord(
          dailyReportQueryInput.memberId,
        ),
      },
    };
  }
}
