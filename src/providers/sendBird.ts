import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';
import { ConfigsService, ExternalConfigs } from '.';

enum suffix {
  users = 'users',
  groupChannels = 'group_channels',
}

@Injectable()
export class SendBird implements OnModuleInit {
  private appId;
  private appToken;
  private basePath;
  private headers;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbirdApiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbirdApiToken);
    this.basePath = `https://api-${this.appId}.sendbird.com/v3/`;
    this.headers = { 'Api-Token': this.appToken };
  }

  private readonly httpService: HttpService = new HttpService();

  async createUser(params: RegisterSendbirdUserParams): Promise<string | void> {
    const failure = `Sendbird: Failed to create a user`;
    try {
      const result = await this.httpService
        .post(`${this.basePath}${suffix.users}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (result.status === 200) {
        console.log(`Sendbird: Successfully created a user ${params.user_id}`);
        return result.data.access_token;
      } else {
        console.error(`${failure} ${result.status} ${this.formatMessage(result.data)}`);
      }
    } catch (ex) {
      console.error(
        `${failure} ${this.formatMessage(ex.config)} ${this.formatMessage(ex.response.data)}`,
      );
    }
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
