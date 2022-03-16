import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import * as path from 'path';
import { Command, InfoColoring } from '../.';
import { AppModule } from '../../../src/app.module';
import { User } from '../../../src/user';

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
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  await userModel.updateMany({}, { orgs: [] });
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
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  await userModel.updateMany({ orgs: { $exists: true } }, { $unset: { orgs: 1 } });
};
