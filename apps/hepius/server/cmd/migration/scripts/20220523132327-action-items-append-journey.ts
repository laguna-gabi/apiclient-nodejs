import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from '../../../src/app.module';
import { Journey } from '../../../src/journey';
import { Db } from 'mongodb';
import { ActionItem } from '../../../src/actionItem';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const journeyModel = app.get<Model<Journey>>(getModelToken(Journey.name));
  const actionItemsModel = app.get<Model<ActionItem>>(getModelToken(ActionItem.name));

  const membersRaw = await db
    .collection('members')
    .find({ actionItems: { $exists: true, $ne: [] } });
  const members = await membersRaw.toArray();

  //Be careful with this: at the time this aggregation run, we only have one journey per member.
  await Promise.all(
    members.map(async (member) => {
      const memberId = new Types.ObjectId(member._id);
      const journey = await journeyModel.findOne({ memberId });
      const journeyId = new Types.ObjectId(journey._id);
      await Promise.all(
        member.actionItems.map(async (actionItem) => {
          await actionItemsModel.findByIdAndUpdate(actionItem, {
            $set: { memberId, journeyId },
          });
        }),
      );
      //Since we've removed the prop actionItems on member, we can't do a standard unset, and
      //must extract it from db raw objects.
      await db.collection('members').updateMany({}, { $unset: { actionItems: 1 } });
    }),
  );
};
