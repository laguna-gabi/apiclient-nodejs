/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { Availability } from '../../../src/availability';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const availabilityModel = app.get<Model<Availability>>(getModelToken(Availability.name));
  await availabilityModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const availabilityModel = app.get<Model<Availability>>(getModelToken(Availability.name));
  await availabilityModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
