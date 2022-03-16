import { Command, InfoColoring } from '../.';
import * as path from 'path';
import { Db } from 'mongodb';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../../src/app.module';
import { Caregiver } from '../../../src/member/caregiver.dto';
import { Model } from 'mongoose';
import { NestFactory } from '@nestjs/core';
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
  const caregiverModel = app.get<Model<Caregiver>>(getModelToken(Caregiver.name));
  await caregiverModel.updateMany({}, { deleted: false });
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
  const caregiverModel = app.get<Model<Caregiver>>(getModelToken(Caregiver.name));
  await caregiverModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
