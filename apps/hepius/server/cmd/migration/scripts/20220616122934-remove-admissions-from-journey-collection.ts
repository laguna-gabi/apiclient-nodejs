import { Db } from 'mongodb';

export const up = async (dryRun: boolean, db: Db) => {
  await db.collection('journeys').updateMany({}, { $unset: { admissions: 1 } });
};
