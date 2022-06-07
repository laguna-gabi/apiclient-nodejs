import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { QuestionnaireResponse } from '../../../src/questionnaire';
import { Db } from 'mongodb';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const questionnaireResponseModel = app.get<Model<QuestionnaireResponse>>(
    getModelToken(QuestionnaireResponse.name),
  );

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    journeys.map(async (journey) => {
      await questionnaireResponseModel.update(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

export const down = async (dryRun: boolean, db: Db) => {
  await db.collection('questionnaireresponses').updateMany({}, { $unset: { journeyId: 1 } });
};
