import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';
import { ConfigsService, ExternalConfigs } from '.';
import { AppointmentStatus } from '../appointment';

enum suffix {
  users = 'users',
  groupChannels = 'group_channels',
}

@Injectable()
export class SendBird implements OnModuleInit {
  private appId;
  private appToken;
  public basePath;
  public headers;
  public METADATA_KEY = 'appointments';

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

  /**
   * in client sdk: https://sendbird.com/docs/chat/v3/javascript/guides/user-and-channel-metadata
   * it must know the key - appointmentId, so we're not able to set the key as the appointmentId
   * since the client doesn't know whats the appointment in the chat view.
   */
  async updateGroupChannelMetadata(
    channelUrl: string,
    appointmentId: string,
    value: { status: AppointmentStatus; start: Date },
  ) {
    const current = await this.httpService
      .get(
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/metadata?keys=${this.METADATA_KEY}`,
        {
          headers: this.headers,
        },
      )
      .toPromise();

    const currentAppointments: any = current.data.appointments
      ? JSON.parse(current.data.appointments)
      : {};
    currentAppointments[appointmentId] = value;

    await this.httpService
      .put(
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/metadata/${this.METADATA_KEY}`,
        { value: JSON.stringify(currentAppointments), upsert: true },
        {
          headers: this.headers,
        },
      )
      .toPromise();
  }

  async deleteGroupChannelMetadata(channelUrl: string, appointmentId: string) {
    const current = await this.httpService
      .get(
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/metadata?keys=${this.METADATA_KEY}`,
        {
          headers: this.headers,
        },
      )
      .toPromise();

    const currentAppointments = JSON.parse(current.data.appointments);
    currentAppointments[appointmentId] = undefined;

    await this.httpService
      .put(
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/metadata/${this.METADATA_KEY}`,
        { value: JSON.stringify(currentAppointments), upsert: true },
        {
          headers: this.headers,
        },
      )
      .toPromise();
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

  private formatMessage(message: string): string {
    return JSON.stringify(message, undefined, 2);
  }
}
