import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import * as path from 'path';
import { Command, InfoColoring } from '../.';
import { AppModule } from '../../../src/app.module';
import { Appointment, AppointmentStatus } from '../../../src/appointment';

const deleted = 'deleted';

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

  // ignoring this since 'deleted' is no longer a status
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await appointmentModel.updateMany({ status: { $ne: deleted } }, { $set: { deleted: false } });
  await appointmentModel.updateMany(
    // ignoring this since 'deleted' is no longer a status - this will have a deleted status
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    { status: deleted },
    { $set: { deleted: true, status: AppointmentStatus.done } },
  );
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
  await appointmentModel.updateMany({ deleted: false }, { $unset: { deleted: 1 } });
  await appointmentModel.updateMany(
    { deleted: true },
    // ignoring this since 'deleted' is no longer a status - this will have a deleted status
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    { $unset: { deleted: 1 }, $set: { status: deleted } },
  );
};
