/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';
import { QuestionnaireType } from '../../../src/questionnaire';

// ------------------------------------------------------------------------------------------------
// Description: migrate `up`
// ------------------------------------------------------------------------------------------------
export const up = async (dryRun: boolean, db: Db) => {
  // Note! if dry-run mode is applied the changelog will NOT get updated.
  //------------------------------------------------------------------------------------------------
  // migration (up) code here...
  //------------------------------------------------------------------------------------------------
  await db.collection('questionnaires').updateMany(
    {
      type: {
        $in: [
          QuestionnaireType.gad7,
          QuestionnaireType.phq9,
          QuestionnaireType.nps,
          QuestionnaireType.who5,
          QuestionnaireType.cage,
          QuestionnaireType.rcqtv,
          QuestionnaireType.lhp,
        ],
      },
    },
    { $set: { buildResult: true } },
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
  await db.collection('questionnaires').updateMany(
    {
      type: {
        $in: [
          QuestionnaireType.gad7,
          QuestionnaireType.phq9,
          QuestionnaireType.nps,
          QuestionnaireType.who5,
          QuestionnaireType.cage,
          QuestionnaireType.rcqtv,
          QuestionnaireType.lhp,
        ],
      },
    },
    { $unset: { buildResult: 1 } },
  );
};
