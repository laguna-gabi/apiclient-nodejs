/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberConfig } from '../../../src/member';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);

  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  await memberModel.updateMany({}, { deleted: false });

  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));
  await memberConfigModel.updateMany({}, { deleted: false });

  await db.collection('archivemembers').drop();
  await db.collection('archivememberconfigs').drop();
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  const app = await NestFactory.createApplicationContext(AppModule);

  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  await memberModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });

  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));
  await memberConfigModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
