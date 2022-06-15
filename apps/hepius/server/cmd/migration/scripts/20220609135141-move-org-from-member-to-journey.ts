import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Member } from '../../../src/member';
import { Journey } from '../../../src/journey';
import { Db } from 'mongodb';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  const members = await memberModel.find({}, { _id: 1, org: 1 }).lean();
  await Promise.all(
    members.map(
      async (member) =>
        await journeyModel.findOneAndUpdate(
          { memberId: member._id },
          { $set: { org: member.org } },
        ),
    ),
  );

  await db.collection('members').updateMany({}, { $unset: { org: 1 } });
};

export const down = async (dryRun: boolean, db: Db) => {
  const memberModel = db.collection('members');

  const journeysRaw = await db.collection('journeys').find({});
  const journeys = await journeysRaw.toArray();

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  journeys.map(async (journey) => {
    await memberModel.findOneAndUpdate({ _id: journey.memberId }, { $set: { org: journey.org } });
  });
  await db.collection('journeys').updateMany({}, { $unset: { org: 1 } });
};
