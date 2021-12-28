import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import * as config from 'config';
import { LoggerService } from '../../common';

@Injectable()
export class CognitoService {
  private readonly cognito = new AWS.CognitoIdentityServiceProvider({
    region: config.get('aws.region'),
    apiVersion: '2016-04-18',
  });

  constructor(private readonly logger: LoggerService) {}

  async disableMember(deviceId): Promise<void> {
    this.logger.info({ deviceId }, CognitoService.name, this.disableMember.name);
    try {
      await this.cognito
        .adminDisableUser({ UserPoolId: config.get('aws.cognito.userPoolId'), Username: deviceId })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(deviceId, CognitoService.name, this.disableMember.name, ex);
      }
    }
  }

  async deleteMember(deviceId): Promise<void> {
    this.logger.info({ deviceId }, CognitoService.name, this.deleteMember.name);
    try {
      await this.cognito
        .adminDeleteUser({ UserPoolId: config.get('aws.cognito.userPoolId'), Username: deviceId })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(deviceId, CognitoService.name, this.deleteMember.name, ex);
      }
    }
  }
}
