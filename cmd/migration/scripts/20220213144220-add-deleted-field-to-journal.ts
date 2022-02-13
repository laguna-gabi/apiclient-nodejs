import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Command } from '../.';
import * as path from 'path';
import { InfoColoring } from '../.';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { Journal } from '../../../src/member';

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
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));
  await journalModel.updateMany({}, { deleted: false });
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
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));
  await journalModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
