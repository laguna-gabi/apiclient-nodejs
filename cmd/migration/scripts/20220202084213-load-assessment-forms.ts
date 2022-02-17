/* eslint-disable max-len */
import { Command } from '../.';
import * as path from 'path';
import { InfoColoring } from '../.';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { NestFactory } from '@nestjs/core';
import { QuestionnaireService } from '../../../src/questionnaire';
import {
  buildGAD7Questionnaire,
  buildNPSQuestionnaire,
  buildPHQ9Questionnaire,
  buildWHO5Questionnaire,
} from '../../../cmd/statics';
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  db.collection('questionnaires').drop();
};
