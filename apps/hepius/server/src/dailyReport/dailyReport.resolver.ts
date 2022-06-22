import { MemberRole, UserRole } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
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
  LoggerService,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  Roles,
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
    @Args(
      camelCase(DailyReportCategoriesInput.name),
      { type: () => DailyReportCategoriesInput },
      new ParseDailyReportInputTransform(),
    )
    dailyReportCategoriesInput: DailyReportCategoriesInput,
  ): Promise<DailyReport> {
    return this.dailyReportService.setDailyReportCategories(dailyReportCategoriesInput);
  }

  @Query(() => DailyReportResults)
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(UserRole.lagunaCoach, UserRole.coach, MemberRole.member)
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
  }
}
