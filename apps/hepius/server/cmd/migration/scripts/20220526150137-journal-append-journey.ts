import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journal, Journey } from '../../../src/journey';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    journeys.map(async (journey) => {
      await journalModel.updateOne(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journalModel = app.get<Model<Journal>>(getModelToken(Journal.name));

  await journalModel.updateMany({}, { $unset: { journeyId: 1 } });
};
