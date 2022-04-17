import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { MemberConfig } from '../../../src/member';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));

  await memberConfigModel.updateMany({}, { isGraduated: false });
};

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberConfigModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));

  await memberConfigModel.updateMany({}, { $unset: { isGraduated: 1 } });
};
