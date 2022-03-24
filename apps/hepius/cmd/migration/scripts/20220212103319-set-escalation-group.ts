import { Db } from 'mongodb';
import { Types } from 'mongoose';
// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
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
export const down = async (dryRun: boolean, db: Db) => {
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
