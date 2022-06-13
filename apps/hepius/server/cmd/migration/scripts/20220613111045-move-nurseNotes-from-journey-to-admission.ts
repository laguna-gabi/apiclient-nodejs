import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../src/app.module';
import { AdmissionService } from '../../../src/journey';
import { Db } from 'mongodb';

export const up = async (dryRun: boolean, db: Db) => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const admissionService = app.get<AdmissionService>(AdmissionService);
  const journeysRaw = await db.collection('journeys').find({ nurseNotes: { $exists: 1 } });
  const journeys = await journeysRaw.toArray();

  /**
   * Be careful with this: at the time this aggregation run:
   * 1. we only have one journey per member.
   * 2. we did not have any admission record for any member - so here we're creating a single
   * admission if the member had nurseNotes.
   * In the following migrations - we need to check if a member has admission already or not.
   */
  await Promise.all(
    journeys.map(async (journey) => {
      await admissionService.change({
        memberId: journey.memberId.toString(),
        journeyId: journey._id.toString(),
        nurseNotes: journey.nurseNotes,
      });
    }),
  );

  await db
    .collection('journeys')
    .updateMany({ nurseNotes: { $exists: true } }, { $unset: { nurseNotes: 1 } });
};

export const down = async (dryRun: boolean, db: Db) => {
  /**
   * Be careful with this: at the time this aggregation run there were no admissions
   */
  await db.collection('admissions').deleteMany({});
};
