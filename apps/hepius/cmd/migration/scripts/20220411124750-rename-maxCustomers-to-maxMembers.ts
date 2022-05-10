import { User } from '@argus/hepiusClient';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  await userModel.updateMany({}, { $rename: { maxCustomers: 'maxMembers' } });
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  await userModel.updateMany({}, { $rename: { maxMembers: 'maxCustomers' } });
};
