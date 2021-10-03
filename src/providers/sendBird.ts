import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';
import { ConfigsService, ExternalConfigs } from '.';
import { AppointmentStatus } from '../appointment';
import { Logger } from '../common';

enum suffix {
  users = 'users',
  groupChannels = 'group_channels',
}

@Injectable()
export class SendBird implements OnModuleInit {
  private readonly logger = new Logger(SendBird.name);
  private appId;
  private appToken;
  public basePath;
  public headers;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    this.basePath = `https://api-${this.appId}.sendbird.com/v3/`;
    this.headers = { 'Api-Token': this.appToken };
  }

  private readonly httpService: HttpService = new HttpService();

  async createUser(params: RegisterSendbirdUserParams): Promise<string | undefined> {
    const failure = `Failed to create a user`;
    try {
      const result = await this.httpService
        .post(`${this.basePath}${suffix.users}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (result.status === 200) {
        this.logger.log(`Successfully created a user ${params.user_id}`);
        return result.data.access_token;
      } else {
        this.logger.error(`${failure} ${result.status} ${result.data}`);
      }
    } catch (ex) {
      this.logger.error(`${failure} ${ex.config} ${ex.response.data}`);
    }
  }

  async createGroupChannel(params: CreateSendbirdGroupChannelParams): Promise<boolean> {
    const result = await this.httpService
      .post(`${this.basePath}${suffix.groupChannels}`, params, {
        headers: this.headers,
      })
      .toPromise();

    if (result.status === 200) {
      this.logger.log(`Successfully created a group channel for users ${params.user_ids}`);
      return true;
    } else {
      this.logger.error(`Failed to create a group channel`, result.status, result.data);
      return false;
    }
  }

  async updateGroupChannelMetadata(
    channelUrl: string,
    appointmentId: string,
    value: { status: AppointmentStatus; start: Date },
  ) {
    await this.update(channelUrl, appointmentId, value);
  }

  async deleteGroupChannelMetadata(channelUrl: string, appointmentId: string) {
    await this.update(channelUrl, appointmentId);
  }

  async freezeGroupChannel(channelUrl: string, freeze: boolean) {
    await this.httpService
      .put(
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/freeze`,
        { freeze },
        {
          headers: this.headers,
        },
      )
      .toPromise();
  }

  private async update(
    channelUrl: string,
    appointmentId: string,
    value?: { status: AppointmentStatus; start: Date },
  ) {
    const url = `${this.basePath}${suffix.groupChannels}/${channelUrl}`;
    const current = await this.httpService.get(url, { headers: this.headers }).toPromise();

    let data: any = current.data.data ? JSON.parse(current.data.data) : {};
    if (!data.appointments) {
      data = { ...data, appointments: {} };
    }
    data.appointments[appointmentId] = value;

    await this.httpService
      .put(url, { data: JSON.stringify(data) }, { headers: this.headers })
      .toPromise();
  }
}
