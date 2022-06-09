import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { Db } from 'mongodb';
import { Barrier, CarePlan } from '@argus/hepiusClient';
import { RedFlag } from '../../../src/care';

export const up = async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const barrierModel = app.get<Model<Barrier>>(getModelToken(Barrier.name));
  const redFlagModel = app.get<Model<RedFlag>>(getModelToken(RedFlag.name));
  const carePlanModel = app.get<Model<CarePlan>>(getModelToken(CarePlan.name));

  const journeys = await journeyModel.find({}, { _id: 1, memberId: 1 });

  const updateMany = async (model, journey) =>
    await model.updateMany(
      { memberId: journey.memberId },
      { $set: { journeyId: journey._id } },
      { upsert: false },
    );

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    journeys.map(async (journey) => {
      await Promise.all(
        [barrierModel, redFlagModel, carePlanModel].map(
          async (model) => await updateMany(model, journey),
        ),
      );
    }),
  );
};

export const down = async (dryRun: boolean, db: Db) => {
  const collections = ['barriers', 'redflags', 'careplans'];
  await Promise.all(
    collections.map(
      async (collection) =>
        await db.collection(collection).updateMany({}, { $unset: { journeyId: 1 } }),
    ),
  );
};
