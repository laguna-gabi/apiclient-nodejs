/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { Journal } from '../../../src/journey';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));
  await journalModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));
  await journalModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
