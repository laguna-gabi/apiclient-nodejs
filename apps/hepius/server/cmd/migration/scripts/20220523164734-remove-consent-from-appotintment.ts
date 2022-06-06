/* eslint-disable @typescript-eslint/no-unused-vars */
import { Appointment } from '@argus/hepiusClient';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Recording } from '../../../src/recording';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  await db
    .collection('appointments')
    .updateMany({ recordingConsent: { $exists: true } }, { $unset: { recordingConsent: 1 } });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule);

  const appointmentModel = app.get<Model<Appointment>>(getModelToken(Appointment.name));
  const recordingModel = app.get<Model<Recording>>(getModelToken(Recording.name));

  await appointmentModel.updateMany({}, { $set: { recordingConsent: false } });
  const recordingsWithConsent = await recordingModel.find({ consent: true });

  await Promise.all(
    recordingsWithConsent.map(async (recording) => {
      await appointmentModel.updateMany(
        { _id: recording.appointmentId },
        { $set: { recordingConsent: true } },
      );
    }),
  );
};
