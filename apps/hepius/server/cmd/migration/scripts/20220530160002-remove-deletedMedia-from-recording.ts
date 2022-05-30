/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('recordings').updateMany({}, { $unset: { deletedMedia: 1 } });
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('recordings').updateMany({}, { $set: { deletedMedia: false } });
};
