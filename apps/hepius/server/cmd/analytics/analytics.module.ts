import { Module } from '@nestjs/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { AnalyticsService } from '.';
import { UserModule } from '../../src/user';
import { MongooseModule } from '@nestjs/mongoose';
import { Org, OrgDto } from '../../src/org';
import { QuestionnaireModule } from '../../src/questionnaire';
import { CareModule } from '../../src/care';
import { JourneyModule } from '../../src/journey';

@Module({
  imports: [
    MemberModule,
    UserModule,
    ProvidersModule,
    QuestionnaireModule,
    CareModule,
    JourneyModule,
    MongooseModule.forFeature([{ name: Org.name, schema: OrgDto }]),
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
