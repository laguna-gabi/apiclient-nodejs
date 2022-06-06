import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { Db } from 'mongodb';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const membersRaw = await db.collection('members').find({ readmissionRisk: { $exists: true } });
  const members = await membersRaw.toArray();
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await Promise.all(
    members.map(async (member) => {
      //Be careful with this: at the time this aggregation run, we only have one journey per member.
      await journeyModel.updateMany(
        { memberId: member._id, readmissionRisk: null },
        {
          $set: {
            readmissionRisk: member.readmissionRisk,
            readmissionRiskHistory: member.readmissionRiskHistory,
          },
        },
        { upsert: true },
      );
    }),
  );

  await db
    .collection('members')
    .updateMany({}, { $unset: { readmissionRisk: 1, readmissionRiskHistory: 1 } });
};

export const down = async (dryRun: boolean, db: Db) => {
  const journeysRaw = await db.collection('journeys').find({ readmissionRisk: { $exists: true } });
  const journeys = await journeysRaw.toArray();

  await Promise.all(
    journeys.map(async (journey) => {
      await db.collection('members').updateMany(
        { _id: journey.memberId, readmissionRisk: { $ne: null } },
        {
          $set: {
            readmissionRisk: journey.readmissionRisk,
            readmissionRiskHistory: journey.readmissionRiskHistory,
          },
        },
        { upsert: true },
      );
    }),
  );

  await db
    .collection('journeys')
    .updateMany({}, { $unset: { readmissionRisk: 1, readmissionRiskHistory: 1 } });
};
