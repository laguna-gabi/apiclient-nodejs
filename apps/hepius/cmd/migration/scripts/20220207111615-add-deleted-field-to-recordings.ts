/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { Recording } from '../../../src/member';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { NestFactory } from '@nestjs/core';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const recordingModel = app.get<Model<Recording>>(getModelToken(Recording.name));
  await recordingModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const recordingModel = app.get<Model<Recording>>(getModelToken(Recording.name));
  await recordingModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
