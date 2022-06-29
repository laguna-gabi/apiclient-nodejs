/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Questionnaire, QuestionnaireService, QuestionnaireType } from '../../../src/questionnaire';
import { buildReadinessToChangeQuestionnaire } from '../../static';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const qService = app.get<QuestionnaireService>(QuestionnaireService);
  await qService.createQuestionnaire(buildReadinessToChangeQuestionnaire());
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const questionnaireModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await questionnaireModel.deleteOne({ type: QuestionnaireType.rcqtv });
};
