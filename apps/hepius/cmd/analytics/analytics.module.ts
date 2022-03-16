import { Module } from '@nestjs/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { AnalyticsService } from '.';
import { UserModule } from '../../src/user';
import { MongooseModule } from '@nestjs/mongoose';
import { Org, OrgDto } from '../../src/org';

@Module({
  imports: [
    MemberModule,
    UserModule,
    ProvidersModule,
    MongooseModule.forFeature([{ name: Org.name, schema: OrgDto }]),
  ],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
