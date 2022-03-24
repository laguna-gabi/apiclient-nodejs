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
  await qrModel.updateMany({ type: QuestionnaireType.phq9 }, { isAssignableToMember: true });
  await qrModel.updateMany({ type: QuestionnaireType.gad7 }, { isAssignableToMember: true });
  await qrModel.updateMany({ type: QuestionnaireType.who5 }, { isAssignableToMember: true });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await qrModel.updateMany(
    { isAssignableToMember: { $exists: true } },
    { $unset: { isAssignableToMember: 1 } },
  );
};
