/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Db } from 'mongodb';
import { Questionnaire, QuestionnaireService, QuestionnaireType } from '../../../src/questionnaire';
import { buildWHO5Questionnaire } from '../../static';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule);

  const qService = app.get<QuestionnaireService>(QuestionnaireService);
  await qService.createQuestionnaire(buildWHO5Questionnaire());
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  const app = await NestFactory.createApplicationContext(AppModule);

  const questionnaireModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));

  const who5Questionnaires = await questionnaireModel
    .find({ type: QuestionnaireType.who5 })
    .sort({ name: -1 });

  if (who5Questionnaires.length >= 1) {
    // remove the latest `who5` questionnaire we added
    await questionnaireModel.deleteOne({ _id: who5Questionnaires[0]._id });

    // rollback to previous version if one exists
    if (who5Questionnaires.length > 1) {
      await questionnaireModel.updateOne(
        { _id: who5Questionnaires[1]._id },
        { $set: { active: true } },
      );
    }
  }
};
