/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { NestFactory } from '@nestjs/core';
import { QuestionnaireService } from '../../../src/questionnaire';
import {
  buildGAD7Questionnaire,
  buildNPSQuestionnaire,
  buildPHQ9Questionnaire,
  buildWHO5Questionnaire,
} from '../../static';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule);

  // get the Member model from the Nest factory
  const qService = app.get<QuestionnaireService>(QuestionnaireService);

  // GAD-7
  await qService.createQuestionnaire(buildGAD7Questionnaire());
  // PHQ-9
  await qService.createQuestionnaire(buildPHQ9Questionnaire());
  // WHO-5
  await qService.createQuestionnaire(buildWHO5Questionnaire());
  // NPS
  await qService.createQuestionnaire(buildNPSQuestionnaire());
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('questionnaires').drop();
};
