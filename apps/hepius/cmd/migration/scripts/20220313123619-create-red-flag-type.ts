/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { seedRedFlags } from '../../static/seedCare';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { RedFlagType } from '../../../src/care';
import { getModelToken } from '@nestjs/mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const redFlagTypeModel = app.get<Model<RedFlagType>>(getModelToken(RedFlagType.name));
  await Promise.all(
    seedRedFlags.map(async (redFlag) => {
      await redFlagTypeModel.create({ ...redFlag });
    }),
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  await db.collection('redflagtypes').drop();
};
