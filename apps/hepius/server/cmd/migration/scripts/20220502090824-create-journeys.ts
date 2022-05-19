import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Member } from '../../../src/member';
import { Journey } from '../../../src/journey';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  const members = await memberModel.find({}, { _id: 1 });
  await journeyModel.insertMany(members.map(({ _id }) => ({ memberId: _id })));
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await journeyModel.deleteMany({});
};
