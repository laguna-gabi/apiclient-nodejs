import { generatePhone, mockLogger } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { LoggerService } from '../../src/common';
import { CognitoService } from '../../src/providers';
import { name } from 'faker';
import { v4 } from 'uuid';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import { AdminGetUserResponse } from 'aws-sdk/clients/cognitoidentityserviceprovider';

describe('live: cognito', () => {
  let cognitoService: CognitoService;

  const cognito = new AWS.CognitoIdentityServiceProvider({
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
      email: 'hadas@lagunahealth.com',
      phone: generatePhone(),
    };

    const authId = await cognitoService.addUser(user);
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
  }, 10000);

  const getClient = async (userName): Promise<AdminGetUserResponse> => {
    return cognito
      .adminGetUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
      .promise();
  };
});
