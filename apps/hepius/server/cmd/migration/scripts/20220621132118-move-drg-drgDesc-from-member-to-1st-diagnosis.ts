import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { AdmissionService, JourneyService } from '../../../src/journey';
import { Db } from 'mongodb';
import { Types } from 'mongoose';
import axios from 'axios';
import { ChangeType } from '../../../src/common';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const admissionService = app.get<AdmissionService>(AdmissionService);
  const journeyService = app.get<JourneyService>(JourneyService);
  const nonAlignedMemberId = new Types.ObjectId('622f9b184e203499331fe782');
  /**
   * ignoring drgDesc, as we'll use a public api to make the names more official and less free text
   * https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&maxList=100&terms=
   */
  const membersRaw = await db.collection('members').find({
    $or: [{ drg: { $exists: 1 } }, { _id: nonAlignedMemberId }],
  });
  const members = await membersRaw.toArray();
  const url =
    'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&maxList=1&terms=';

  /**
   * Be careful with this: at the time this aggregation run:
   * 1. we only have one journey per member.
   * 2. we might have a single admission record for a member - as created on
   * 20220613111045-move-nurseNotes-from-journey-to-admission.ts and
   * 20220616135238-move-admitDate-from-member-to-1st-admission.ts
   * 20220619153631-move-dischargeDate-from-member-to-1st-admission.ts
   * so we'll :
   * 1. if admission exists for a member, we'll append drg and/or drgDesc on the same admission found.
   * 2. if admission does not exist for a member, we'll create an admission with drg and/or drgDesc.
   */
  await Promise.all(
    members.map(async (member) => {
      //special member on prd which doesn't have drg, but has a specific drgDesc
      member.drg = member._id.toString() !== nonAlignedMemberId.toString() ? member.drg : 'K80.80';
      const results = await axios.get(`${url}${member.drg}`);
      if (results.data[3].length === 1) {
        const recentJourney = await journeyService.getRecent(member._id.toString());
        const admissions = await admissionService.get({
          memberId: member._id.toString(),
          journeyId: recentJourney.id,
        });
        const idObject = admissions.length >= 1 ? { id: admissions[0].id } : {};
        const description = results.data[3][0][1];
        console.log(
          `member=${member._id} admission=${idObject}, ` +
            `drg=${member.drg}, description=${description}`,
        );
        const diagnosis =
          admissions.length >= 1 && admissions[0].diagnoses.length >= 1
            ? {
                changeType: ChangeType.update,
                id: admissions[0].diagnoses[0].id,
                code: member.drg,
                description,
              }
            : { changeType: ChangeType.create, code: member.drg, description };
        await admissionService.change({
          ...idObject,
          memberId: member._id.toString(),
          journeyId: recentJourney.id,
          diagnosis,
        });
        await db
          .collection('members')
          .updateOne({ _id: member._id }, { $unset: { drg: 1, drgDesc: 1 } });
      } else {
        console.error(`failed to get icd code`, member._id, member.drg);
      }
    }),
  );
};
