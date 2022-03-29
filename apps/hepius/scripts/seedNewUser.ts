import { SeedBase } from './seedBase';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { Mutations } from '../test/aux';
import { delay } from '../src/common';
import { CreateUserParams } from '../src/user';
import { aws } from 'config';
import { Environments } from '@argus/pandora';

/**************************************************************************************************
 ********************************************** Init **********************************************
 *************************************************************************************************/
let userPoolId;
let mutations: Mutations;
let base: SeedBase;

const cognito = new CognitoIdentityServiceProvider({
  region: aws.region,
  apiVersion: '2016-04-18',
});

// users list can be obtained from notion : https://www.notion.so/lagunahealth/Users-list-d8e083b21ba149199f74332cc79dfde3
const users = [];
/**************************************************************************************************
 ******************************************* Finish Init ******************************************
 *************************************************************************************************/

/**
 * Insert a user object on users field above
 */
export async function newUser() {
  base = new SeedBase();
  await base.init();
  mutations = base.mutations;
  userPoolId = aws.cognito.userPoolId;

  await Promise.all(
    users.map(async (user) => {
      await generateUser(user);
    }),
  );
}

const generateUser = async (user: Partial<CreateUserParams>) => {
  const params: CognitoIdentityServiceProvider.Types.AdminCreateUserRequest = {
    UserPoolId: userPoolId,
    Username: user.firstName.toLowerCase(),
    TemporaryPassword: '1qaz2wsx',
    DesiredDeliveryMediums: ['EMAIL'],
    UserAttributes: [
      { Name: 'email', Value: user.email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'phone_number', Value: user.phone },
      { Name: 'phone_number_verified', Value: 'true' },
    ],
  };

  const { User } = await cognito.adminCreateUser(params).promise();
  const { Value } = User.Attributes.find((att) => att.Name === 'sub');

  if (process.env.NODE_ENV === Environments.production) {
    await cognito
      .adminSetUserMFAPreference({
        SMSMfaSettings: { Enabled: true, PreferredMfa: true },
        Username: User.Username,
        UserPoolId: params.UserPoolId,
      })
      .promise();
  }

  const createUserParams = { authId: Value, ...user };
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await mutations.createUser({ createUserParams });

  await delay(5000);
  await base.cleanUp();
};
