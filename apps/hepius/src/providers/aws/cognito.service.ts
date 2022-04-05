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

  async disableClient(userName): Promise<boolean> {
    this.logger.info({ userName }, CognitoService.name, this.disableClient.name);
    try {
      await this.cognito
        .adminDisableUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
        .promise();
      return true;
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(userName, CognitoService.name, this.disableClient.name, formatEx(ex));
      }
      return false;
    }
  }

  async enableClient(userName): Promise<boolean> {
    // this.logger.info({ userName }, CognitoService.name, this.enableClient.name);
    try {
      await this.cognito
        .adminEnableUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
        .promise();
      return true;
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(userName, CognitoService.name, this.enableClient.name, formatEx(ex));
      }
      return false;
    }
  }

  async deleteClient(userName: string): Promise<void> {
    this.logger.info({ userName }, CognitoService.name, this.deleteClient.name);
    try {
      await this.cognito
        .adminDeleteUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
        .promise();
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(userName, CognitoService.name, this.deleteClient.name, formatEx(ex));
      }
    }
  }
}
