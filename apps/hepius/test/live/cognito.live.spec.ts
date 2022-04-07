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

  it('should add, disable, enable and delete a client', async () => {
    const user = {
      firstName: `${name.firstName()}.${v4()}`,
      email: 'hadas@lagunahealth.com',
      phone: generatePhone(),
    };

    const authId = await cognitoService.addClient(user);
    expect(authId).not.toBeUndefined();

    let currentClient = await getClient(user.firstName);
    expect(currentClient.Enabled).toBeTruthy();
    expect(currentClient.Username).toEqual(user.firstName.toLowerCase());
    expect(currentClient.UserAttributes).toEqual([
      { Name: 'sub', Value: authId },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'phone_number_verified', Value: 'true' },
      { Name: 'phone_number', Value: user.phone },
      { Name: 'email', Value: user.email },
    ]);

    const disableResult = await cognitoService.disableClient(user.firstName);
    expect(disableResult).toBeTruthy();
    currentClient = await getClient(user.firstName);
    expect(currentClient.Enabled).toBeFalsy();

    const enableResult = await cognitoService.enableClient(user.firstName);
    expect(enableResult).toBeTruthy();
    currentClient = await getClient(user.firstName);
    expect(currentClient.Enabled).toBeTruthy();

    const deleteResult = await cognitoService.deleteClient(user.firstName);
    expect(deleteResult).toBeTruthy();
    await expect(getClient(user.firstName)).rejects.toThrow(new Error('User does not exist.'));
  }, 10000);

  const getClient = async (userName): Promise<AdminGetUserResponse> => {
    return cognito
      .adminGetUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
      .promise();
  };
});
