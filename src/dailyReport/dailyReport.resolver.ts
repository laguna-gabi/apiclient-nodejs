import { ContentKey, InternalNotificationType } from '@lagunahealth/pandora';
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
  ErrorType,
  Errors,
  EventType,
  IEventMember,
  InternalNotifyParams,
  Logger,
  LoggingInterceptor,
  MemberRole,
  Roles,
  UserRole,
  extractRoles,
  extractUserId,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class DailyReportResolver {
  constructor(
    private readonly dailyReportService: DailyReportService,
    readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  @Mutation(() => DailyReport)
  @Roles(MemberRole.member)
  async setDailyReportCategories(
    @Context() context,
    @Args(
      camelCase(DailyReportCategoriesInput.name),
      { type: () => DailyReportCategoriesInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportCategoriesInput: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    if (!extractRoles(context).includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    // ignoring the id from the params - replacing it with the id from the context
    dailyReportCategoriesInput.memberId = extractUserId(context);
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

  @Query(() => DailyReportResults)
  @Roles(UserRole.coach, MemberRole.member)
  async getDailyReports(
    @Context() context,
    @Args(
      camelCase(DailyReportQueryInput.name),
      { type: () => DailyReportQueryInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportQueryInput: DailyReportQueryInput,
  ): Promise<DailyReportResults> {
    if (extractRoles(context).includes(MemberRole.member)) {
      dailyReportQueryInput.memberId = extractUserId(context);
    }
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
