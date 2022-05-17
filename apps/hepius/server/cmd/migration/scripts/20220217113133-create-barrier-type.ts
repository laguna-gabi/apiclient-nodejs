/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { createSeedBarriers } from '../../static';
import { BarrierType, CarePlanType } from '@argus/hepiusClient';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const barrierTypeModel = app.get<Model<BarrierType>>(getModelToken(BarrierType.name));
  const carePlanTypeModel = app.get<Model<CarePlanType>>(getModelToken(CarePlanType.name));
  await createSeedBarriers(barrierTypeModel, carePlanTypeModel);
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  await db.collection('barriertypes').drop();
};
