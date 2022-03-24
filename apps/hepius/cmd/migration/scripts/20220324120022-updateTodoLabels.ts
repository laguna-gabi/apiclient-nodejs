/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Todo } from '../../../src/todo';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  await todoModel.updateMany({ label: 'MEDS' }, { label: 'Meds' });
  await todoModel.updateMany({ label: 'APPT' }, { label: 'Appointment' });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  const app = await NestFactory.createApplicationContext(AppModule);
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  await todoModel.updateMany({ label: 'Meds' }, { label: 'MEDS' });
  await todoModel.updateMany({ label: 'Appointment' }, { label: 'APPT' });
};
