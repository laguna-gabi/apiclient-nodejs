import { HttpService, Injectable } from '@nestjs/common';
import * as config from 'config';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';

enum suffix {
  users = 'users',
  groupChannels = 'group_channels',
}

@Injectable()
export class SendBird {
  private readonly appId = config.get('providers.sendbird.appId');
  private readonly appToken = config.get('providers.sendbird.appToken');
  private readonly basePath = `https://api-${this.appId}.sendbird.com/v3/`;
  private readonly headers = { 'Api-Token': this.appToken };

  private readonly httpService: HttpService = new HttpService();

  async createUser(params: RegisterSendbirdUserParams): Promise<boolean> {
    const failure = `Sendbird: Failed to create a user`;
    try {
      const result = await this.httpService
        .post(`${this.basePath}${suffix.users}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (result.status === 200) {
        console.log(`Sendbird: Successfully created a user ${params.user_id}`);
        return true;
      } else {
        console.error(`${failure} ${result.status} ${this.formatMessage(result.data)}`);
      }
    } catch (ex) {
      console.error(
        `${failure} ${this.formatMessage(ex.config)} ${this.formatMessage(ex.response.data)}`,
      );
    }

    return false;
  }

  async createGroupChannel(params: CreateSendbirdGroupChannelParams): Promise<boolean> {
    const result = await this.httpService
      .post(`${this.basePath}${suffix.groupChannels}`, params, {
        headers: this.headers,
      })
      .toPromise();

    if (result.status === 200) {
      console.log(`Sendbird: Successfully created a group channel for users ${params.user_ids}`);
      return true;
    } else {
      console.error(`Sendbird: Failed to create a group channel`, result.status, result.data);
      return false;
    }
  }

  private formatMessage(message: string): string {
    return JSON.stringify(message, undefined, 2);
  }
}
