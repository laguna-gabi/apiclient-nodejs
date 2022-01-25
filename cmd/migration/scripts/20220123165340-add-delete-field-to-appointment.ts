import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import * as path from 'path';
import { Command, InfoColoring } from '../.';
import { AppModule } from '../../../src/app.module';
import { Appointment } from '../../../src/appointment';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const appointmentModel = app.get<Model<Appointment>>(getModelToken(Appointment.name));
  // ignoring this since 'deleted' is no longer a status - this will have a deleted status
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await appointmentModel.updateMany({ status: 'deleted' }, { deleted: true });
  // ignoring this since 'deleted' is no longer a status
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await appointmentModel.updateMany({ status: { $ne: 'deleted' } }, { deleted: false });
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

  const app = await NestFactory.createApplicationContext(AppModule);
  const appointmentModel = app.get<Model<Appointment>>(getModelToken(Appointment.name));
  await appointmentModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
