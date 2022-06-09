import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { ControlMember } from '../../../src/member';
import { ControlJourney } from '../../../src/journey';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const controlMemberModel = app.get<Model<ControlMember>>(getModelToken(ControlMember.name));
  const controlJourneyModel = app.get<Model<ControlJourney>>(getModelToken(ControlJourney.name));

  const controlMembers = await controlMemberModel.find({}, { _id: 1 });
  await controlJourneyModel.insertMany(controlMembers.map(({ _id }) => ({ memberId: _id })));
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const controlJourneyModel = app.get<Model<ControlJourney>>(getModelToken(ControlJourney.name));

  await controlJourneyModel.deleteMany({});
};
