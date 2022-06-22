import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyReport, DailyReportDto, DailyReportResolver, DailyReportService } from '.';
import { CommonModule } from '../common';
import { JourneyModule } from '../journey';
import { MemberModule } from '../member';

@Module({
  imports: [
    CommonModule,
    JourneyModule,
    MemberModule,
    MongooseModule.forFeature([{ name: DailyReport.name, schema: DailyReportDto }]),
  ],
  providers: [DailyReportResolver, DailyReportService],
  exports: [DailyReportService],
})
export class DailyReportModule {}
