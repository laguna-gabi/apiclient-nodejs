import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { camelCase } from 'lodash';
import {
  DailyReport,
  DailyReportCategoriesInput,
  DailyReportQueryInput,
  DailyReportResults,
  DailyReportService,
  ParseDailyReportInputTransform,
} from '.';
import { Roles } from '../auth/decorators/role.decorator';
import { Roles as RoleTypes } from '../auth/roles';
import {
  EventType,
  InternalNotificationType,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
} from '../common';

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
        type: InternalNotificationType.textSmsToUser,
        userId: context.req?.user?.primaryUserId,
        metadata: {
          content: `${config
            .get('contents.memberNotFeelingWellMessage')
            .replace('@member.honorific@', context.req?.user?.honorific)
            .replace('@member.lastName@', context.req?.user?.lastName)}`,
        },
      };

      this.eventEmitter.emit(EventType.internalNotify, params);

      this.logMemberOverThresholdIndication(dailyReportCategoriesInput.memberId);

      await this.dailyReportService.setNotificationIndication(
        dailyReportCategoriesInput.memberId,
        dailyReportCategoriesInput.date,
      );
    }

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

  //----------------------------------------------------------------
  // Service Methods
  //----------------------------------------------------------------
  logMemberOverThresholdIndication(memberId: string) {
    this.logger.log(
      { memberId },
      DailyReportService.name,
      this.logMemberOverThresholdIndication.name,
    );
  }
}
