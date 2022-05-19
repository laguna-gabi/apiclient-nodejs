import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Member } from '../../../src/member';
import { Journey } from '../../../src/journey';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pastModel = app.get<Model<Member>>(getModelToken(Member.name));
  const futureModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  await migrate(pastModel, futureModel, '_id', 'memberId');
};

export const down = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const pastModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const futureModel = app.get<Model<Member>>(getModelToken(Member.name));

  await migrate(pastModel, futureModel, 'memberId', '_id');
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const migrate = async (pastModel: Model, futureModel: Model, pastModelField, futureModelField) => {
  const objects = await pastModel
    .find({}, { [`${pastModelField}`]: 1, generalNotes: 1, nurseNotes: 1 })
    .lean();

  await Promise.all(
    objects.map(async (data) => {
      await futureModel.updateMany(
        { [`${futureModelField}`]: data._id },
        { $set: { generalNotes: data.generalNotes, nurseNotes: data.nurseNotes } },
        { upsert: true },
      );
    }),
  );

  await pastModel.updateMany({}, { $unset: { generalNotes: 1 } });
  await pastModel.updateMany({}, { $unset: { nurseNotes: 1 } });
};
