import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import { LoggerService } from '../../common';
import { formatEx } from '@argus/pandora';

@Injectable()
export class CognitoService {
  private readonly cognito = new AWS.CognitoIdentityServiceProvider({
    region: aws.region,
    apiVersion: '2016-04-18',
  });

  constructor(private readonly logger: LoggerService) {}

  async disableMember(deviceId): Promise<void> {
    this.logger.info({ deviceId }, CognitoService.name, this.disableMember.name);
    try {
      await this.cognito
        .adminDisableUser({ UserPoolId: aws.cognito.userPoolId, Username: deviceId })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(deviceId, CognitoService.name, this.disableMember.name, formatEx(ex));
      }
    }
  }

  async deleteMember(deviceId): Promise<void> {
    this.logger.info({ deviceId }, CognitoService.name, this.deleteMember.name);
    try {
      await this.cognito
        .adminDeleteUser({ UserPoolId: aws.cognito.userPoolId, Username: deviceId })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(deviceId, CognitoService.name, this.deleteMember.name, formatEx(ex));
      }
    }
  }
}
