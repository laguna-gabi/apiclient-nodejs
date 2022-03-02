import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Command, InfoColoring } from '../.';
import * as path from 'path';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { Todo, TodoDone } from '../../../src/todo';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  const todoDoneModel = app.get<Model<TodoDone>>(getModelToken(TodoDone.name));
  await todoModel.updateMany({}, { deleted: false });
  await todoDoneModel.updateMany({}, { deleted: false });
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

  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  const todoDoneModel = app.get<Model<TodoDone>>(getModelToken(TodoDone.name));
  await todoModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
  await todoDoneModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
