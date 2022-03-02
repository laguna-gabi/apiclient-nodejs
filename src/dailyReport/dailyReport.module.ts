import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyReport, DailyReportDto, DailyReportResolver, DailyReportService } from '.';
import { CommonModule } from '../common';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DailyReport.name, schema: DailyReportDto }]),
    CommonModule,
  ],
  providers: [DailyReportResolver, DailyReportService],
  exports: [DailyReportService],
})
export class DailyReportModule {}
