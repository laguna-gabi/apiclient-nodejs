import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { Logger } from '../../common';

@Injectable()
export class CognitoService {
  private readonly cognito = new AWS.CognitoIdentityServiceProvider({
    region: config.get('providers.aws.region'),
    apiVersion: '2016-04-18',
  });

  constructor(private readonly logger: Logger) {}

  async disableMember(deviceId) {
    this.logger.debug({ deviceId }, CognitoService.name, this.disableMember.name);
    try {
      await this.cognito
        .adminDisableUser({ UserPoolId: config.get('cognito.userPoolId'), Username: deviceId })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(deviceId, CognitoService.name, this.disableMember.name, ex);
      }
    }
  }
}
