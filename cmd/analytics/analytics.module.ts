import { Module } from '@nestjs/common';
import { MemberModule } from '../../src/member';
import { ProvidersModule } from '../../src/providers';
import { AnalyticsService } from '.';
import { UserModule } from '../../src/user';

@Module({
  imports: [MemberModule, UserModule, ProvidersModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
