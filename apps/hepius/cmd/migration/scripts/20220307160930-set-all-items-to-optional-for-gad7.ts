/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { Questionnaire, QuestionnaireType } from '../../../src/questionnaire';
import { AppModule } from '../../../src/app.module';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  qrModel.updateMany({}, { isAssignableToMember: false });
  await qrModel.updateMany(
    { type: QuestionnaireType.gad7 },
    { $set: { 'items.$[].required': false, 'items.$[].items.$[].required': false } },
  );
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
  const qrModel = app.get<Model<Questionnaire>>(getModelToken(Questionnaire.name));
  await qrModel.updateMany(
    { type: QuestionnaireType.gad7 },
    { $set: { 'items.$[].required': true, 'items.$[].items.$[].required': true } },
  );
};
