/* eslint-disable @typescript-eslint/no-unused-vars */
import { Db } from 'mongodb';

const COLLECTION_NAME = 'orgs';
const nameToCode = {
  NorthshoreBeta: 'noshb',
  Northshore: 'nosh',
  Mayo: 'mayo',
};

export const up = async (dryRun: boolean, db: Db) => {
  const orgs = await db.collection(COLLECTION_NAME).find({}).toArray();
  const relevantOrgs = orgs.filter(({ name }) => nameToCode[name]);
  if (dryRun) {
    relevantOrgs.forEach((org) => {
      console.log(`Change code for ${org.name}: ${org.code} => ${nameToCode[org.name]}`);
    });
    console.log('final result:');
    console.log(relevantOrgs.map((org) => ({ ...org, code: nameToCode[org.name] })));
  } else {
    await Promise.all(
      relevantOrgs.map((org) =>
        db.collection(COLLECTION_NAME).updateOne(
          { name: org.name },
          {
            $set: {
              code: nameToCode[org.name],
            },
          },
        ),
      ),
    );
  }
};

export const down = async (dryRun: boolean, db: Db) => {
  await db.collection(COLLECTION_NAME).updateMany({}, { $unset: { code: '' } });
};
