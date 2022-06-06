/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { Recording } from '../../../src/recording';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const recordingModel = app.get<Model<Recording>>(getModelToken(Recording.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  await Promise.all(
    journeys.map(async (journey) => {
      await recordingModel.updateMany(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  await db.collection('recordings').updateMany({}, { $unset: { journeyId: 1 } });
};
