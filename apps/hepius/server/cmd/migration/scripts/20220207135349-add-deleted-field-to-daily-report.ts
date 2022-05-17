/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { DailyReport } from '../../../src/dailyReport';
import { Model } from 'mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const dailyReportModel = app.get<Model<DailyReport>>(getModelToken(DailyReport.name));
  await dailyReportModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const dailyReportModel = app.get<Model<DailyReport>>(getModelToken(DailyReport.name));
  await dailyReportModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
