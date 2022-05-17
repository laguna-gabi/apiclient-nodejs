import { generatePhone, mockLogger } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { AdminGetUserResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider';
import { aws } from 'config';
import { name } from 'faker';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { v4 } from 'uuid';
import { LoggerService } from '../../src/common';
import { CognitoService } from '../../src/providers';

describe('live: cognito', () => {
  let cognitoService: CognitoService;

  const cognito = new CognitoIdentityServiceProvider({
    region: aws.region,
    apiVersion: '2016-04-18',
  });

  beforeAll(async () => {
    const logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
    mockLogger(logger);

    cognitoService = new CognitoService(logger);
  });

  it('should add, disable, enable, get client enabled and delete a client', async () => {
    const user = {
      firstName: `${name.firstName()}.${v4()}`,
      lastName: `${name.lastName()}.${v4()}`,
      email: 'hadas@lagunahealth.com',
      phone: generatePhone(),
    };

    const { authId } = await cognitoService.addUser(user);
    expect(authId).not.toBeUndefined();

    const currentClient = await getClient(user.firstName.toLowerCase());
    expect(currentClient.Enabled).toBeTruthy();
    expect(currentClient.Username).toEqual(user.firstName.toLowerCase());
    expect(currentClient.UserAttributes).toEqual([
      { Name: 'sub', Value: authId },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'phone_number_verified', Value: 'true' },
      { Name: 'phone_number', Value: user.phone },
      { Name: 'email', Value: user.email },
    ]);

    const disableResult = await cognitoService.disableClient(user.firstName.toLowerCase());
    expect(disableResult).toBeTruthy();
    let isEnabled = await cognitoService.isClientEnabled(user.firstName.toLowerCase());
    expect(isEnabled).toBeFalsy();

    const enableResult = await cognitoService.enableClient(user.firstName.toLowerCase());
    expect(enableResult).toBeTruthy();
    isEnabled = await cognitoService.isClientEnabled(user.firstName.toLowerCase());
    expect(isEnabled).toBeTruthy();

    const deleteResult = await cognitoService.deleteClient(user.firstName.toLowerCase());
    expect(deleteResult).toBeTruthy();
    await expect(getClient(user.firstName.toLowerCase())).rejects.toThrow(
      new Error('User does not exist.'),
    );

    isEnabled = await cognitoService.isClientEnabled(user.firstName.toLowerCase());
    expect(isEnabled).toBeFalsy();
  }, 15000);

  describe('should add multiple users with the same first name', () => {
    const addedUsernames = [];
    const firstName = `${name.firstName()}.${v4()}`;

    const userLastNames = ['Levi', 'Levinsky', 'Levinshtein'];

    afterAll(async () => {
      // delete test users from cognito
      await Promise.all(
        addedUsernames.map(async (username) => {
          await cognitoService.deleteClient(username);
        }),
      );
    });

    /* eslint-disable max-len */
    test.each`
      lastName            | expectedUsername                                      | title
      ${userLastNames[0]} | ${firstName.toLowerCase()}                            | ${`should add user ${firstName} ${userLastNames[0]}`}
      ${userLastNames[1]} | ${`${firstName}${userLastNames[1][0]}`.toLowerCase()} | ${`should add user ${firstName} ${userLastNames[1]}`}
      ${userLastNames[2]} | ${`${firstName}.${userLastNames[2]}`.toLowerCase()}   | ${`should add user ${firstName} ${userLastNames[2]}`}
    `(`$title`, async ({ lastName, expectedUsername }) => {
      const { authId, username } = await cognitoService.addUser({
        firstName,
        lastName,
        email: 'test@lagunahealth.com',
        phone: generatePhone(),
      });
      expect(authId).not.toBeUndefined();

      addedUsernames.push(username); // save the username so we can cleanup `afterAll`

      const currentClient = await getClient(expectedUsername);
      expect(currentClient.Enabled).toBeTruthy();
    });
  });

  const getClient = async (userName): Promise<AdminGetUserResponse> => {
    return cognito
      .adminGetUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
      .promise();
  };
});
