import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { AppointmentStatus } from '../appointment';
import { Logger, SendSendBirdNotification } from '../common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';
import { User } from '../user';

enum suffix {
  users = 'users',
  groupChannels = 'group_channels',
}

@Injectable()
export class SendBird implements OnModuleInit {
  private appId;
  private appToken;
  private masterApiToken;
  public basePath;
  public headers;

  constructor(private readonly configsService: ConfigsService, private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    this.masterApiToken = await this.configsService.getConfig(
      ExternalConfigs.sendbird.masterApiToken,
    );
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

  async deleteGroupChannel(channelUrl: string) {
    await this.httpService
      .delete(`${this.basePath}${suffix.groupChannels}/${channelUrl}`, {
        headers: this.headers,
      })
      .toPromise();
  }

  // userId from sendBird not users
  async deleteUser(userId: string) {
    await this.httpService
      .delete(`${this.basePath}${suffix.users}/${userId}`, {
        headers: this.headers,
      })
      .toPromise();
  }

  getAppToken() {
    return this.appToken;
  }

  getMasterAppToken() {
    return this.masterApiToken;
  }

  // TODO: split the appointment logic and turn into a more generic function with updateChannelName
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

  async updateChannelName(sendBirdChannelUrl: string, name: string, cover_url: string) {
    const methodName = this.updateChannelName.name;
    try {
      const result = await this.httpService
        .put(
          `${this.basePath}${suffix.groupChannels}/${sendBirdChannelUrl}`,
          {
            name,
            cover_url,
          },
          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.debug({ sendBirdChannelUrl }, SendBird.name, methodName);
        return result;
      } else {
        this.logger.error({ sendBirdChannelUrl }, SendBird.name, methodName);
      }
    } catch (ex) {
      this.logger.error({ sendBirdChannelUrl }, SendBird.name, methodName);
    }
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
    const { userId, sendBirdChannelUrl, message, notificationType } = sendSendBirdNotification;
    const methodName = this.send.name;
    try {
      const result = await this.httpService
        .post(
          `${this.basePath}${suffix.groupChannels}/${sendBirdChannelUrl}/messages`,
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

  async invite(sendBirdChannelUrl: string, userId: string) {
    const methodName = this.invite.name;
    try {
      const result = await this.httpService
        .post(
          `${this.basePath}${suffix.groupChannels}/${sendBirdChannelUrl}/invite`,
          {
            user_ids: [userId],
          },
          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.debug({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
        return result;
      } else {
        this.logger.error({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
      }
    } catch (ex) {
      this.logger.error({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
    }
  }

  async leave(sendBirdChannelUrl: string, userId: string) {
    const methodName = this.leave.name;
    try {
      const result = await this.httpService
        .put(
          `${this.basePath}${suffix.groupChannels}/${sendBirdChannelUrl}/leave`,
          {
            user_ids: [userId],
          },
          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.debug({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
        return result;
      } else {
        this.logger.error({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
      }
    } catch (ex) {
      this.logger.error({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
    }
  }

  async replaceUserInChannel(sendBirdChannelUrl: string, oldUserId: string, newUser: User) {
    await this.leave(sendBirdChannelUrl, oldUserId);
    await this.invite(sendBirdChannelUrl, newUser.id);
    await this.updateChannelName(sendBirdChannelUrl, newUser.firstName, newUser.avatar);
  }
}
