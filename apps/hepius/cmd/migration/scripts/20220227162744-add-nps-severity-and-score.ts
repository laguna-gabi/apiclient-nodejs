import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import * as path from 'path';
import { Command, InfoColoring } from '../.';
import { AppModule } from '../../../src/app.module';
import { Questionnaire, QuestionnaireType } from '../../../src/questionnaire';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await qrModel.updateMany(
    { type: QuestionnaireType.nps, severityLevels: { $exists: true } },
    { $unset: { severityLevels: 1 } },
  );
};
