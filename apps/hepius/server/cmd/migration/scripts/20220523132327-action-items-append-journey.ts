import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { ActionItem, Journey } from '../../../src/journey';
import { Member } from '../../../src/member';
import { Db } from 'mongodb';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const actionItemsModel = app.get<Model<ActionItem>>(getModelToken(ActionItem.name));

  const members = await memberModel.find(
    { actionItems: { $exists: true, $ne: [] } },
    { _id: 1, actionItems: 1 },
  );

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    members.map(async ({ _id, actionItems }) => {
      const memberId = new Types.ObjectId(_id);
      const journey = await journeyModel.findOne({ memberId });
      const journeyId = new Types.ObjectId(journey._id);
      actionItems.map(async (actionItem) => {
        await actionItemsModel.findByIdAndUpdate(actionItem, { $set: { memberId, journeyId } });
      });
      //Since we've removed the prop actionItems on member, we can't do a standard unset, and
      //must extract it from db raw objects.
      await db.collection('members').updateMany({}, { $unset: { actionItems: 1 } });
    }),
  );
};
