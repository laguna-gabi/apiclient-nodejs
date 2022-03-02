import { Command, InfoColoring } from '../.';
import * as path from 'path';
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { DailyReport } from '../../../src/dailyReport';
import { Model } from 'mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const dailyReportModel = app.get<Model<DailyReport>>(getModelToken(DailyReport.name));
  await dailyReportModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const dailyReportModel = app.get<Model<DailyReport>>(getModelToken(DailyReport.name));
  await dailyReportModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
