import { Module } from '@nestjs/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { AnalyticsService } from '.';
import { UserModule } from '../../src/user';
import { MongooseModule } from '@nestjs/mongoose';
import { Org, OrgDto } from '../../src/org';
import { QuestionnaireModule } from '../../src/questionnaire';

@Module({
  imports: [
    MemberModule,
    UserModule,
    ProvidersModule,
    QuestionnaireModule,
    MongooseModule.forFeature([{ name: Org.name, schema: OrgDto }]),
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
