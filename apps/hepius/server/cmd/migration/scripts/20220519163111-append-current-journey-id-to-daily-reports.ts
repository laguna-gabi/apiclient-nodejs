import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { DailyReport } from '../../../src/dailyReport';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const dailyReportModel = app.get<Model<DailyReport>>(getModelToken(DailyReport.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    journeys.map(async (journey) => {
      await dailyReportModel.updateOne(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dailyReportModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await dailyReportModel.updateMany({}, { $unset: { journeyId: 1 } });
};
