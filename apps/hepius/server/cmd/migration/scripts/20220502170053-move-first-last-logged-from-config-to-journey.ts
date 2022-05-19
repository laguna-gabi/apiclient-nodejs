import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { MemberConfig } from '../../../src/member';
import { Journey } from '../../../src/journey';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pastModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));
  const futureModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await migrate(pastModel, futureModel);
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pastModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const futureModel = app.get<Model<MemberConfig>>(getModelToken(MemberConfig.name));

  await migrate(pastModel, futureModel);
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const migrate = async (pastModel: Model, futureModel: Model) => {
  const configs = await pastModel
    .find({}, { memberId: 1, firstLoggedInAt: 1, lastLoggedInAt: 1 })
    .lean();

  await Promise.all(
    configs.map(async (config) => {
      const setValueFirstLoggedIn = config.firstLoggedInAt
        ? { firstLoggedInAt: config.firstLoggedInAt }
        : {};
      const setValueLastLoggedIn = config.lastLoggedInAt
        ? { lastLoggedInAt: config.lastLoggedInAt }
        : {};
      await futureModel.findOneAndUpdate(
        { memberId: config.memberId },
        { $set: { ...setValueFirstLoggedIn, ...setValueLastLoggedIn } },
        { upsert: true },
      );
    }),
  );

  await pastModel.updateMany({}, { $unset: { firstLoggedInAt: 1, lastLoggedInAt: 1 } });
};
