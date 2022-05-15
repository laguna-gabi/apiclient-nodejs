import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/member';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await journeyModel.updateMany({}, { $unset: { isActive: 1 } });
  await journeyModel.updateMany({}, { $set: { active: true } });
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await journeyModel.updateMany({}, { $unset: { active: 1 }, $set: { isActive: true } });
};
