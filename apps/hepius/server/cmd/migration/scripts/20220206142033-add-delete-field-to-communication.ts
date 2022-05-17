/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Communication } from '../../../src/communication';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const communicationModel = app.get<Model<Communication>>(getModelToken(Communication.name));
  await communicationModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const communicationModel = app.get<Model<Communication>>(getModelToken(Communication.name));
  await communicationModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
