import { model, mongo } from 'mongoose';
import { Identifier } from '../src/common';
import { Org, OrgDto } from '../src/org';
import { dbConnect, dbDisconnect, generateCreateUserParams, generateOrgParams } from '../test';
import { SeedBase } from './seedBase';

/**
 * This is a seed file for initial dev db creation.
 * The objects we're creating are:
 * 1. laguna employees users
 * 2. laguna clients organizations
 *
 * Note (!): Note: authId should have the same value as cognito 'sub'
 * for this user to be allowed access
 */

const lagunaEmployeesList = [
  {
    name: 'Gilli',
    authId: '1fa97144-0a9e-432a-94c2-ce04f31b15c4',
  },
  {
    name: 'Sharon',
    authId: '1fa97143-0a9e-432a-94c2-ce04fb4j1ec5',
  },
  {
    name: 'Hadas',
    authId: '1fa47143-0a9e-432a-94c2-ce04fb4j1ec5',
  },
];

const lagunaClientsOrganizations = [
  { name: 'Mayo', id: '6113d0fa7cb99c0858c470b5' },
  { name: 'Northshore', id: '6113d0fb7cb99c0858c470e1' },
];

async function main() {
  const base = new SeedBase();
  await base.init();
  await dbConnect();
  const { mutations } = base;

  // --------- Functions ---------

  const createLagunaEmployeeUser = async (name: string, authId: string): Promise<Identifier> => {
    const user = await mutations.createUser({
      userParams: generateCreateUserParams({ firstName: name, authId }),
    });
    console.log(`created a user for ${name} with id: ${user.id}`);
    return { id: user.id };
  };

  const createLagunaEmployeeUsers = async () => {
    await Promise.all(
      lagunaEmployeesList.map(async ({ name, authId }) => createLagunaEmployeeUser(name, authId)),
    );
  };

  const createOrganization = async (name: string, id: string) => {
    const orgModel = model(Org.name, OrgDto);
    const newId = new mongo.ObjectId(id).toString();
    const params = { ...generateOrgParams({ name }), _id: newId };
    await orgModel.create(params);
    console.log(`created ${name} with id: ${id}`);
  };

  const createOrganizations = async () => {
    await Promise.all(
      lagunaClientsOrganizations.map(async ({ name, id }) => createOrganization(name, id)),
    );
  };

  // --------- Flow ---------

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- Creating Users -----------------------------\n' +
      '----------------------------------------------------------------',
  );
  await createLagunaEmployeeUsers();

  console.debug(
    '\n----------------------------------------------------------------\n' +
      '------------------- Creating organizations --------------------\n' +
      '----------------------------------------------------------------',
  );
  await createOrganizations();

  await dbDisconnect();
  await base.cleanUp();
}

(async () => {
  await main();
})();
