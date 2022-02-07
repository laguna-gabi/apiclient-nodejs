import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyReport, DailyReportDto, DailyReportResolver, DailyReportService } from '.';
import { CommonModule } from '../common';
import { useFactoryOptions } from '../db';
import * as mongooseDelete from 'mongoose-delete';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: DailyReport.name,
        useFactory: () => {
          return DailyReportDto.plugin(mongooseDelete, useFactoryOptions);
        },
      },
    ]),
    CommonModule,
  ],
  providers: [DailyReportResolver, DailyReportService],
  exports: [DailyReportService],
})
export class DailyReportModule {}
