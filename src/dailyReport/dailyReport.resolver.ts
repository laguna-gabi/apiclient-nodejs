import { ContentKey, InternalNotificationType, generateDispatchId } from '@lagunahealth/pandora';
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
  Client,
  ErrorType,
  Errors,
  EventType,
  IDispatchParams,
  LoggingInterceptor,
  MemberRole,
  Roles,
  UserRole,
} from '../common';
import { v4 } from 'uuid';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class DailyReportResolver {
  constructor(
    private readonly dailyReportService: DailyReportService,
    readonly eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => DailyReport)
  @Roles(MemberRole.member)
  async setDailyReportCategories(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Client('primaryUserId') primaryUserId,

    @Args(
      camelCase(DailyReportCategoriesInput.name),
      { type: () => DailyReportCategoriesInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportCategoriesInput: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    // ignoring the id from the params - replacing it with the id from the context
    dailyReportCategoriesInput.memberId = memberId;
    const dailyReportObject = await this.dailyReportService.setDailyReportCategories(
      dailyReportCategoriesInput,
    );

    if (
      primaryUserId &&
      dailyReportObject.statsOverThreshold?.length > 0 &&
      !dailyReportObject.notificationSent
    ) {
      const memberNotFeelingWellEvent: IDispatchParams = {
        memberId: dailyReportCategoriesInput.memberId,
        userId: primaryUserId,
        type: InternalNotificationType.textSmsToUser,
        correlationId: v4(),
        dispatchId: generateDispatchId(
          ContentKey.memberNotFeelingWellMessage,
          primaryUserId,
          dailyReportCategoriesInput.memberId,
          Date.now().toString(),
        ),
        metadata: { contentType: ContentKey.memberNotFeelingWellMessage },
      };
      this.eventEmitter.emit(EventType.notifyDispatch, memberNotFeelingWellEvent);

      this.dailyReportService.logMemberOverThresholdIndication(dailyReportCategoriesInput.memberId);

      await this.dailyReportService.setNotificationIndication(
        dailyReportCategoriesInput.memberId,
        dailyReportCategoriesInput.date,
      );
    }
    this.eventEmitter.emit(EventType.notifyDeleteDispatch, {
      dispatchId: generateDispatchId(ContentKey.logReminder, memberId),
    });

    return dailyReportObject;
  }

  @Query(() => DailyReportResults)
  @Roles(UserRole.coach, MemberRole.member)
  async getDailyReports(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Args(
      camelCase(DailyReportQueryInput.name),
      { type: () => DailyReportQueryInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportQueryInput: DailyReportQueryInput,
  ): Promise<DailyReportResults> {
    if (roles.includes(MemberRole.member)) {
      dailyReportQueryInput.memberId = memberId;
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
