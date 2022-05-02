import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey, Member } from '../../../src/member';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  const members = await memberModel.find({}, { _id: 1 });
  await journeyModel.insertMany(members);
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await journeyModel.deleteMany({});
};
