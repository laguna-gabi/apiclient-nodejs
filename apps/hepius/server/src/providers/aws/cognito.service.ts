import { Environments, formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { CognitoIdentityServiceProvider } from 'aws-sdk';
import { aws } from 'config';
import { LoggerService } from '../../common';

@Injectable()
export class CognitoService {
  private static MAX_NUMBER_OF_ATTEMPTS = 3; // safety measure to prevent a stack overflow

  private readonly cognito = new CognitoIdentityServiceProvider({
    region: aws.region,
    apiVersion: '2016-04-18',
  });

  constructor(private readonly logger: LoggerService) {}

  /**
   * @param user
   * @param username: optional. default strategy is to use the user's first name.
   *                  if username is already occupied we'll make additional attempts
   *                  according to a predefined strategy.
   *                  Example: for user `John Doe`:
   *                    1. username: john
   *                    2. username: johnd
   *                    3. username: john.doe
   * Note: more strategies can be added in `getNextAttemptUsername` private method below
   * @return {authId, username}
   */
  async addUser(
    user: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    },
    username?: string,
    attemptCount = 1,
  ): Promise<{ authId: string; username: string }> {
    this.logger.info(user, CognitoService.name, this.addUser.name);

    const params: CognitoIdentityServiceProvider.Types.AdminCreateUserRequest = {
      UserPoolId: aws.cognito.userPoolId,
      Username: username?.toLowerCase() || user.firstName.toLowerCase(),
      TemporaryPassword: '1qaz2wsx',
      DesiredDeliveryMediums: ['EMAIL'],
      UserAttributes: [
        { Name: 'email', Value: user.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'phone_number', Value: user.phone },
        { Name: 'phone_number_verified', Value: 'true' },
      ],
    };

    let User;
    try {
      ({ User } = await this.cognito.adminCreateUser(params).promise());
    } catch (ex) {
      // if username is taken we'll make and additional attempt until we exhaust all username options
      const nextAttemptUsername = this.getNextAttemptUsername(user, params.Username);
      if (
        ex.code === 'UsernameExistsException' &&
        nextAttemptUsername &&
        attemptCount < CognitoService.MAX_NUMBER_OF_ATTEMPTS //
      ) {
        return this.addUser(user, nextAttemptUsername, ++attemptCount);
      } else {
        throw ex;
      }
    }

    const { Value: authId } = User.Attributes.find((att) => att.Name === 'sub');

    if (process.env.NODE_ENV === Environments.production) {
      await this.cognito
        .adminSetUserMFAPreference({
          SMSMfaSettings: { Enabled: true, PreferredMfa: true },
          Username: User.Username,
          UserPoolId: params.UserPoolId,
        })
        .promise();
    }

    return { authId, username: User.Username };
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
    this.logger.info({ userName }, CognitoService.name, this.enableClient.name);
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

  async isClientEnabled(userName: string): Promise<boolean> {
    this.logger.info({ userName }, CognitoService.name, this.isClientEnabled.name);
    try {
      const { Enabled } = await this.cognito
        .adminGetUser({ UserPoolId: aws.cognito.userPoolId, Username: userName })
        .promise();
      return Enabled;
    } catch (ex) {
      if (ex?.code !== 'UserNotFoundException') {
        this.logger.error(userName, CognitoService.name, this.isClientEnabled.name, formatEx(ex));
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

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  /**
   * @param user: a representation of the user to be used for constructing next strategy username
   * @param username: a previously attempted (and rejected) username - got `UsernameExistsException`
   * @Description the function will receive a username which was used in a previous attempt and was
   *              found to be occupied in Cognito and a `user` object and will return the
   *              next (by strategy) username to be used in the next attempt
   * @return username
   *              (if empty string is returned we've exhausted all possible attempts)
   */
  private getNextAttemptUsername(
    user: { firstName: string; lastName: string; email: string; phone: string },
    prevUsername: string,
  ): string {
    switch (prevUsername) {
      case user.firstName.toLowerCase(): {
        return `${user.firstName}${user.lastName[0]}`;
      }
      case `${user.firstName}${user.lastName[0]}`.toLowerCase(): {
        return `${user.firstName}.${user.lastName}`;
      }
      // note: developer can add more strategies here.. (should increment MAX_NUMBER_OF_ATTEMPTS accordingly)
      default: {
        return;
      }
    }
  }
}
