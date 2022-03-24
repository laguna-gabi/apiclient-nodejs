/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-len */
import { Db } from 'mongodb';
import { seedCarePlans } from '../../static/seedCare';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  await db.collection('careplantypes').insertMany(seedCarePlans);
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
export const down = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  await db.collection('careplantypes').drop();
};
