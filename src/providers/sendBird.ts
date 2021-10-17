import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { AppointmentStatus } from '../appointment';
import { Logger, SendSendBirdNotification } from '../common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';

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

  constructor(private readonly configsService: ConfigsService, private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    this.basePath = `https://api-${this.appId}.sendbird.com/v3/`;
    this.headers = { 'Api-Token': this.appToken };
  }

  private readonly httpService: HttpService = new HttpService();

  async createUser(params: RegisterSendbirdUserParams): Promise<string | undefined> {
    const methodName = this.createUser.name;
    try {
      const result = await this.httpService
        .post(`${this.basePath}${suffix.users}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (result.status === 200) {
        this.logger.debug(params, SendBird.name, methodName);
        return result.data.access_token;
      } else {
        this.logger.error(params, SendBird.name, methodName, result.status, result.data);
      }
    } catch (ex) {
      this.logger.error(params, SendBird.name, methodName, ex.config);
    }
  }

  async createGroupChannel(params: CreateSendbirdGroupChannelParams): Promise<boolean> {
    const methodName = this.createGroupChannel.name;
    try {
      const { status, data } = await this.httpService
        .post(`${this.basePath}${suffix.groupChannels}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (status === 200) {
        this.logger.debug(params, SendBird.name, methodName);
        return true;
      } else {
        this.logger.error(params, SendBird.name, methodName, status, data);
        return false;
      }
    } catch (ex) {
      this.logger.error(params, SendBird.name, methodName, ex);
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

  getAppToken() {
    return this.appToken;
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

  async countUnreadMessages(channelUrl: string, userId: string): Promise<number> {
    const { status, data } = await this.httpService
      .get(
        // eslint-disable-next-line max-len
        `${this.basePath}${suffix.groupChannels}/${channelUrl}/messages/unread_count?user_ids=${userId}`,
        {
          headers: this.headers,
        },
      )
      .toPromise();
    if (status === 200) {
      return data.unread[userId];
    } else {
      this.logger.error(
        { channelUrl, userId },
        SendBird.name,
        this.countUnreadMessages.name,
        status,
        data,
      );
    }
  }

  async send(sendSendBirdNotification: SendSendBirdNotification) {
    const { userId, sendbirdChannelUrl, message, notificationType } = sendSendBirdNotification;
    const methodName = this.send.name;
    try {
      const result = await this.httpService
        .post(
          `${this.basePath}${suffix.groupChannels}/${sendbirdChannelUrl}/messages`,
          {
            message_type: 'ADMM', // Only admin type can be sent to a frozen chat
            user_id: userId,
            message,
            custom_type: notificationType, // For use of Laguna Chat
            data: userId, // For use of Laguna Chat
          },

          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.debug(sendSendBirdNotification, SendBird.name, methodName);
        return result.data.message_id;
      } else {
        this.logger.error(sendSendBirdNotification, SendBird.name, methodName);
      }
    } catch (ex) {
      this.logger.error(sendSendBirdNotification, SendBird.name, methodName);
    }
  }
}
