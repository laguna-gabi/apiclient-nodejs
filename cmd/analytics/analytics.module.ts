import { Module } from '@nestjs/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { AnalyticsService } from '.';

@Module({
  imports: [MemberModule, ProvidersModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
