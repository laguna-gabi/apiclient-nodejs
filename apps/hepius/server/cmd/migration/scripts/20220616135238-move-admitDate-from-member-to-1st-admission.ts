import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { AdmissionService, JourneyService } from '../../../src/journey';
import { Db } from 'mongodb';
import { Model } from 'mongoose';
import { Member } from '../../../src/member';
import { getModelToken } from '@nestjs/mongoose';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const admissionService = app.get<AdmissionService>(AdmissionService);
  const journeyService = app.get<JourneyService>(JourneyService);
  const membersRaw = await db.collection('members').find({ admitDate: { $exists: 1 } });
  const members = await membersRaw.toArray();

  /**
   * Be careful with this: at the time this aggregation run:
   * 1. we only have one journey per member.
   * 2. we might have a single admission record for a member - as created on
   * 20220613111045-move-nurseNotes-from-journey-to-admission.ts - so we'll :
   * 1. if admission exists for a member, we'll append the admitDate on the same admission found.
   * 2. if admission does not exist for a member, we'll create an admission with the admitDate.
   */
  await Promise.all(
    members.map(async (member) => {
      const recentJourney = await journeyService.getRecent(member._id.toString());
      const admissions = await admissionService.get({
        memberId: member._id.toString(),
        journeyId: recentJourney.id,
      });
      const idObject = admissions.length >= 1 ? { id: admissions[0].id } : {};
      await admissionService.change({
        ...idObject,
        memberId: member._id.toString(),
        journeyId: recentJourney.id,
        admitDate: member.admitDate,
      });
    }),
  );

  await db
    .collection('members')
    .updateMany({ admitDate: { $exists: true } }, { $unset: { admitDate: 1 } });
};

export const down = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const memberModel = app.get<Model<Member>>(getModelToken(Member.name));
  const admissionsRaw = await db.collection('admissions').find({ admitDate: { $exists: 1 } });
  const admissions = await admissionsRaw.toArray();

  /**
   * Be careful with this: at the time this aggregation run, we only had 1 max admission per member.
   */
  await Promise.all(
    admissions.map(async (admission) => {
      await memberModel.updateOne(
        { _id: admission.memberId },
        { $set: { admitDate: admission.admitDate } },
      );
    }),
  );

  await db
    .collection('admissions')
    .updateMany({ admitDate: { $exists: true } }, { $unset: { admitDate: 1 } });
};
