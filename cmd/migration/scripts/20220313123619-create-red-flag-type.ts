import { Command, InfoColoring } from '../.';
import * as path from 'path';
import { Db } from 'mongodb';
import { seedRedFlags } from '../../static/seedCare';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { RedFlagType } from '../../../src/care';
import { getModelToken } from '@nestjs/mongoose';
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
  const redFlagTypeModel = app.get<Model<RedFlagType>>(getModelToken(RedFlagType.name));
  await Promise.all(
    seedRedFlags.map(async (redFlag) => {
      await redFlagTypeModel.create({ ...redFlag });
    }),
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

  await db.collection('redflagtypes').drop();
};
