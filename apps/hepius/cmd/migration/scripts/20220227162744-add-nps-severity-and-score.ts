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
  await qrModel.updateMany(
    { type: QuestionnaireType.nps },
    {
      severityLevels: [
        { min: 0, max: 6, label: 'Detractor' },
        { min: 7, max: 8, label: 'Passive' },
        { min: 9, max: 10, label: 'Promoter' },
      ],
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
  await qrModel.updateMany(
    { type: QuestionnaireType.nps, severityLevels: { $exists: true } },
    { $unset: { severityLevels: 1 } },
  );
};
