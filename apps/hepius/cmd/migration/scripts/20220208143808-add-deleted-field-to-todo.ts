/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Db } from 'mongodb';
import { AppModule } from '../../../src/app.module';
import { Todo, TodoDone } from '../../../src/todo';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  const todoDoneModel = app.get<Model<TodoDone>>(getModelToken(TodoDone.name));
  await todoModel.updateMany({}, { deleted: false });
  await todoDoneModel.updateMany({}, { deleted: false });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  const todoDoneModel = app.get<Model<TodoDone>>(getModelToken(TodoDone.name));
  await todoModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
  await todoDoneModel.updateMany({ deleted: { $exists: true } }, { $unset: { deleted: 1 } });
};
