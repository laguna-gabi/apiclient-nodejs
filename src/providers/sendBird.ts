import { BaseSendBird, InternalNotificationType } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as download from 'download';
import * as FormData from 'form-data';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { ConfigsService, ExternalConfigs } from '.';
import { AppointmentStatus } from '../appointment';
import { LoggerService, SendSendBirdNotification } from '../common';
import { CreateSendbirdGroupChannelParams, RegisterSendbirdUserParams } from '../communication';
import { AudioFormat } from '../member/journal.dto';
import { User } from '../user';

@Injectable()
export class SendBird extends BaseSendBird implements OnModuleInit {
  private masterApiToken;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    this.masterApiToken = await this.configsService.getConfig(
      ExternalConfigs.sendbird.masterApiToken,
    );
    await super.onModuleInit();
  }

  async createUser(params: RegisterSendbirdUserParams): Promise<string | undefined> {
    const methodName = this.createUser.name;
    try {
      const result = await this.httpService
        .post(`${this.basePath}${this.suffix.users}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (result.status === 200) {
        this.logger.info(params, SendBird.name, methodName);
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
        .post(`${this.basePath}${this.suffix.groupChannels}`, params, {
          headers: this.headers,
        })
        .toPromise();

      if (status === 200) {
        this.logger.info(params, SendBird.name, methodName);
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
        `${this.basePath}${this.suffix.groupChannels}/${channelUrl}/freeze`,
        { freeze },
        {
          headers: this.headers,
        },
      )
      .toPromise();
  }

  async deleteGroupChannel(channelUrl: string) {
    await this.httpService
      .delete(`${this.basePath}${this.suffix.groupChannels}/${channelUrl}`, {
        headers: this.headers,
      })
      .toPromise();
  }

  // userId from sendBird not users
  async deleteUser(userId: string) {
    await this.httpService
      .delete(`${this.basePath}${this.suffix.users}/${userId}`, {
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
    const url = `${this.basePath}${this.suffix.groupChannels}/${channelUrl}`;
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
          `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}`,
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
        this.logger.info({ sendBirdChannelUrl }, SendBird.name, methodName);
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
        /* eslint-disable-next-line max-len */
        `${this.basePath}${this.suffix.groupChannels}/${channelUrl}/messages/unread_count?user_ids=${userId}`,
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
    this.logger.info(sendSendBirdNotification, SendBird.name, this.send.name);
    if (sendSendBirdNotification.notificationType === InternalNotificationType.chatMessageJournal) {
      return this.sendJournalMessage(sendSendBirdNotification);
    } else {
      return this.sendAdminMessage(sendSendBirdNotification);
    }
  }

  async sendJournalMessage(sendSendBirdNotification: SendSendBirdNotification) {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.sendJournalMessage.name);
    const {
      userId,
      sendBirdChannelUrl,
      message,
      notificationType,
      appointmentId,
      journalImageDownloadLink,
      journalAudioDownloadLink,
    } = sendSendBirdNotification;
    try {
      if (journalImageDownloadLink) {
        const imageDownloadResult = await this.httpService
          .get(journalImageDownloadLink, { responseType: 'stream' })
          .toPromise();

        const imageFormat = imageDownloadResult.headers['content-type'].split('/')[1];

        await download(journalImageDownloadLink).pipe(
          createWriteStream(`./${userId}.${imageFormat}`),
        );

        const form = new FormData();
        form.append('user_id', userId);
        form.append('message_type', 'FILE');
        form.append('file', createReadStream(`./${userId}.${imageFormat}`));
        form.append('apns_bundle_id', 'com.cca.MyChatPlain');
        form.append('custom_type', notificationType); // For use of Laguna Chat
        form.append('data', JSON.stringify({ senderId: userId, appointmentId, message })); // For use of Laguna Chat);

        const result = await this.httpService
          .post(
            `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/messages`,
            form,
            {
              headers: {
                ...form.getHeaders(),
                ...this.headers,
                // eslint-disable-next-line max-len
                'Content-Type': `multipart/form-data; boundary=${imageDownloadResult.headers['content-type']}`,
              },
            },
          )
          .toPromise();

        await unlink(`./${userId}.${imageFormat}`);

        if (result.status !== 200) {
          this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalMessage.name);
        }
      } else {
        const result = await this.httpService
          .post(
            `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/messages`,
            {
              message_type: 'MESG',
              user_id: userId,
              message,
              custom_type: notificationType,
              data: JSON.stringify({ senderId: userId, appointmentId, message }),
            },
            { headers: this.headers },
          )
          .toPromise();
        if (result.status !== 200) {
          this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalMessage.name);
        }
      }
      if (journalAudioDownloadLink) {
        const audioDownloadResult = await this.httpService
          .get(journalAudioDownloadLink, { responseType: 'stream' })
          .toPromise();

        const audioFormat =
          audioDownloadResult.headers['content-type'] === 'audio/mp4'
            ? AudioFormat.m4a
            : AudioFormat.mp3;

        await download(journalAudioDownloadLink).pipe(
          createWriteStream(`./${userId}.${audioFormat}`),
        );

        const form = new FormData();
        form.append('user_id', userId);
        form.append('message_type', 'FILE');
        form.append('file', createReadStream(`./${userId}.${audioFormat}`));
        form.append('apns_bundle_id', 'com.cca.MyChatPlain');
        form.append('custom_type', notificationType); // For use of Laguna Chat
        form.append('data', JSON.stringify({ senderId: userId, appointmentId, message })); // For use of Laguna Chat);

        const result = await this.httpService
          .post(
            `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/messages`,
            form,
            {
              headers: {
                ...form.getHeaders(),
                ...this.headers,
                // eslint-disable-next-line max-len
                'Content-Type': `multipart/form-data; boundary=${audioDownloadResult.headers['content-type']}`,
              },
            },
          )
          .toPromise();

        await unlink(`./${userId}.${audioFormat}`);

        if (result.status !== 200) {
          this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalMessage.name);
        }
        return true;
      }
    } catch (ex) {
      this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalMessage.name, ex);
    }
  }

  async sendAdminMessage(sendSendBirdNotification: SendSendBirdNotification) {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.sendAdminMessage.name);
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } =
      sendSendBirdNotification;
    try {
      const result = await this.httpService
        .post(
          `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/messages`,
          {
            message_type: 'ADMM', // Only admin type can be sent to a frozen chat
            user_id: userId,
            message,
            custom_type: notificationType, // For use of Laguna Chat
            data: JSON.stringify({
              senderId: userId,
              appointmentId,
            }), // For use of Laguna Chat
          },
          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        return result.data.message_id;
      } else {
        this.logger.error(sendSendBirdNotification, SendBird.name, this.sendAdminMessage.name);
      }
    } catch (ex) {
      this.logger.error(sendSendBirdNotification, SendBird.name, this.sendAdminMessage.name, ex);
    }
  }

  async invite(sendBirdChannelUrl: string, userId: string): Promise<string[] | void> {
    const methodName = this.invite.name;
    try {
      const result = await this.httpService
        .post(
          `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/invite`,
          { user_ids: [userId] },
          { headers: this.headers },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.info({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
        return result.data.members?.map((member) => member.user_id);
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
          `${this.basePath}${this.suffix.groupChannels}/${sendBirdChannelUrl}/leave`,
          {
            user_ids: [userId],
          },
          {
            headers: this.headers,
          },
        )
        .toPromise();
      if (result.status === 200) {
        this.logger.info({ sendBirdChannelUrl, userId }, SendBird.name, methodName);
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
