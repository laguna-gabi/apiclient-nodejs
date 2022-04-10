import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { aws } from 'config';
import { LoggerService } from '../../common';
import { Environments, formatEx } from '@argus/pandora';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

@Injectable()
export class CognitoService {
  private readonly cognito = new AWS.CognitoIdentityServiceProvider({
    region: aws.region,
    apiVersion: '2016-04-18',
  });

  constructor(private readonly logger: LoggerService) {}

  /**
   * @param user
   * @return authId
   */
  async addClient(user: { firstName: string; email: string; phone: string }): Promise<string> {
    this.logger.info(user, CognitoService.name, this.addClient.name);

    const params: CognitoIdentityServiceProvider.Types.AdminCreateUserRequest = {
      UserPoolId: aws.cognito.userPoolId,
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

    const { User } = await this.cognito.adminCreateUser(params).promise();
    const { Value } = User.Attributes.find((att) => att.Name === 'sub');

    if (process.env.NODE_ENV === Environments.production) {
      await this.cognito
        .adminSetUserMFAPreference({
          SMSMfaSettings: { Enabled: true, PreferredMfa: true },
          Username: User.Username,
          UserPoolId: params.UserPoolId,
        })
        .promise();
    }

    return Value;
  }

  async disableClient(userName: string): Promise<boolean> {
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

  async enableClient(userName: string): Promise<boolean> {
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

  async deleteClient(userName: string): Promise<boolean> {
    this.logger.info({ userName }, CognitoService.name, this.deleteClient.name);
    try {
      await this.cognito
        .adminDeleteUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
        .promise();
      return true;
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(userName, CognitoService.name, this.deleteClient.name, formatEx(ex));
      }
      return false;
    }
  }
}
