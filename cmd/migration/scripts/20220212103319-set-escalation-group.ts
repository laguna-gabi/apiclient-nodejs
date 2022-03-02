import { Command, InfoColoring } from '../.';
import * as path from 'path';
import { Db } from 'mongodb';
import { Types } from 'mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const up = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.up} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('users').updateMany(
    {
      _id: {
        $in: [
          new Types.ObjectId('619e6bc5d7920e74f34f774e'), // Jeff (in stage)
          new Types.ObjectId('619e6c148b34c2751b9877f6'), // Melissa (in stage)
        ],
      },
    },
    { $set: { inEscalationGroup: true } },
  );
};

// ------------------------------------------------------------------------------------------------
// Description: migrate `down`
// ------------------------------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const down = async (dryRun: boolean, db: Db) => {
  console.info(
    InfoColoring,
    `(${path.basename(__filename)}) migrating ${Command.down} ${dryRun ? 'in dry run mode' : ''}`,
  );
  // Note! if dry-run mode is applied the changelog will NOT get updated.

  //------------------------------------------------------------------------------------------------
  // migration (down) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('users').updateMany(
    {
      _id: {
        $in: [
          new Types.ObjectId('619e6bc5d7920e74f34f774e'), // Jeff (in stage)
          new Types.ObjectId('619e6c148b34c2751b9877f6'), // Melissa (in stage)
        ],
      },
    },
    { $unset: { inEscalationGroup: 1 } },
  );
};
