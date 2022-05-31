/* eslint-disable @typescript-eslint/no-unused-vars */
import { User } from '@argus/hepiusClient';
import { NestFactory } from '@nestjs/core';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../../../src/app.module';

import { Db } from 'mongodb';
import { capitalize } from '../../../src/common';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const users = await userModel.find();

  await Promise.all(
    users.map(async (user) => {
      await userModel.updateOne(
        { _id: new Types.ObjectId(user.id) },
        { roles: user.roles.map((role) => `laguna${capitalize(role)}`) },
      );
    }),
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const users = await userModel.find();

  await Promise.all(
    users.map(async (user) => {
      await userModel.updateOne(
        { _id: new Types.ObjectId(user.id) },
        { roles: user.roles.map((role) => role.replace('laguna', '').toLowerCase()) },
      );
    }),
  );
};
