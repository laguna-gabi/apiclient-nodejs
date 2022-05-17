import { Db } from 'mongodb';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  await db.collection('members').updateMany({}, { $unset: { language: '' } });
  await db.collection('memberconfigs').updateMany({}, { $set: { language: 'en' } });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  await db.collection('members').updateMany({}, { $set: { language: 'en' } });
  await db.collection('memberconfigs').updateMany({}, { $unset: { language: '' } });
};
