import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Admission, Journey } from '../../../src/journey';
import { Db } from 'mongodb';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const admissionModel = app.get<Model<Admission>>(getModelToken(Admission.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    journeys.map(async (journey) => {
      await admissionModel.updateMany(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

export const down = async (dryRun: boolean, db: Db) => {
  await db.collection('admissions').updateMany({}, { $unset: { journeyId: 1 } });
};
