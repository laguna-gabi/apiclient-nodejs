/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { MemberConfig } from '../../../src/member';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));
  await memberConfigModel.updateMany({}, { isTodoNotificationsEnabled: true });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);
  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));
  await memberConfigModel.updateMany(
    { isTodoNotificationsEnabled: { $exists: true } },
    { $unset: { isTodoNotificationsEnabled: 1 } },
  );
};
