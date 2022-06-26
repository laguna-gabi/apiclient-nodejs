/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { Model } from 'mongoose';
import { ActionItem, ActionItemStatus } from '../../../src/actionItem';
import { getModelToken } from '@nestjs/mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const actionItemModel = app.get<Model<ActionItem>>(getModelToken(ActionItem.name));

  await actionItemModel.updateMany(
    { status: 'pending' },
    { $set: { status: ActionItemStatus.active } },
  );
  await actionItemModel.updateMany(
    { status: 'reached' },
    { $set: { status: ActionItemStatus.completed } },
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const actionItemModel = app.get<Model<ActionItem>>(getModelToken(ActionItem.name));

  await actionItemModel.updateMany(
    { status: ActionItemStatus.active },
    { $set: { status: 'pending' } },
  );
  await actionItemModel.updateMany(
    { status: ActionItemStatus.completed },
    { $set: { status: 'reached' } },
  );
};
