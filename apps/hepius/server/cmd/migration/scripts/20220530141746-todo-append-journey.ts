/* eslint-disable @typescript-eslint/no-unused-vars */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { Todo, TodoDone } from '../../../src/todo';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const todoModel = app.get<Model<Todo>>(getModelToken(Todo.name));
  const todoDoneModel = app.get<Model<TodoDone>>(getModelToken(TodoDone.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  await Promise.all(
    journeys.map(async (journey) => {
      await todoModel.updateMany(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
      await todoDoneModel.updateMany(
        { memberId: journey.memberId },
        { $set: { journeyId: journey._id } },
        { upsert: false },
      );
    }),
  );
};

export const down = async (dryRun: boolean, db: Db) => {
  await db.collection('todos').updateMany({}, { $unset: { journeyId: 1 } });
  await db.collection('tododones').updateMany({}, { $unset: { journeyId: 1 } });
};
