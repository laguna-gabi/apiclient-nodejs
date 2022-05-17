/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Questionnaire, QuestionnaireType } from '../../../src/questionnaire';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await qrModel.updateMany({}, { isAssignableToMember: false });
  await qrModel.updateMany(
    { type: QuestionnaireType.who5 },
    {
      $set: {
        'items.$[].label':
          'Please respond to each item by selecting one ' +
          'answer per row regarding how you felt in the last two weeks.',
      },
    },
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await qrModel.updateMany({}, { isAssignableToMember: false });
  await qrModel.updateMany(
    { type: QuestionnaireType.who5 },
    {
      $set: {
        'items.$[].label':
          'Please respond to each item by marking one box per row, ' +
          'regarding how you felt in the last two weeks.',
      },
    },
  );
};
