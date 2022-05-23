import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyReport, DailyReportDto, DailyReportResolver, DailyReportService } from '.';
import { CommonModule } from '../common';
import { JourneyModule } from '../journey';

@Module({
  imports: [
    CommonModule,
    JourneyModule,
    MongooseModule.forFeature([{ name: DailyReport.name, schema: DailyReportDto }]),
  ],
  providers: [DailyReportResolver, DailyReportService],
  exports: [DailyReportService],
})
export class DailyReportModule {}
