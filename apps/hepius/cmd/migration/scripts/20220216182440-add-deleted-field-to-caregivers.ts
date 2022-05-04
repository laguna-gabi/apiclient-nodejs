/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { NestFactory } from '@nestjs/core';
import { Caregiver } from '@argus/hepiusClient';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const caregiverModel = app.get<Model<Caregiver>>(getModelToken(Caregiver.name));
  await caregiverModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const caregiverModel = app.get<Model<Caregiver>>(getModelToken(Caregiver.name));
  await caregiverModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
