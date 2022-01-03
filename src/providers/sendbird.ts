import { BaseSendBird, InternalNotificationType, formatEx } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as FormData from 'form-data';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import {
  ConfigsService,
  ExternalConfigs,
  Provider,
  ProviderResult,
  SendSendBirdNotification,
} from '.';
import { Logger } from '../common';

@Injectable()
export class SendBird extends BaseSendBird implements OnModuleInit {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    await super.onModuleInit();
  }

  async send(sendSendBirdNotification: SendSendBirdNotification): Promise<ProviderResult> {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.send.name);
    const { journalImageDownloadLink, journalAudioDownloadLink, notificationType, message } =
      sendSendBirdNotification;
    let id;

    if (notificationType === InternalNotificationType.chatMessageJournal) {
      if (journalImageDownloadLink) {
        id = await this.sendJournalImage(sendSendBirdNotification);
      } else {
        id = await this.sendJournalText(sendSendBirdNotification);
      }
      if (journalAudioDownloadLink) {
        await this.sendJournalAudio(sendSendBirdNotification);
      }
    } else {
      id = await this.sendAdminMessage(sendSendBirdNotification);
    }
    return { provider: Provider.sendbird, content: message, id };
  }

  async sendJournalText(sendSendBirdNotification: SendSendBirdNotification) {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.sendJournalText.name);
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } =
      sendSendBirdNotification;
    try {
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
      if (result.status === 200) {
        return result.data.message_id;
      } else {
        this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalText.name, {
          code: result.status,
          data: result.data,
        });
      }
    } catch (ex) {
      this.logger.error(
        sendSendBirdNotification,
        SendBird.name,
        this.sendJournalText.name,
        formatEx(ex),
      );
    }
  }

  async sendJournalImage(sendSendBirdNotification: SendSendBirdNotification) {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.sendJournalImage.name);
    const {
      userId,
      sendBirdChannelUrl,
      message,
      notificationType,
      appointmentId,
      journalImageDownloadLink,
    } = sendSendBirdNotification;
    try {
      const imageDownloadResult = await this.httpService
        .get(journalImageDownloadLink, { responseType: 'stream' })
        .toPromise();

      const imageFormat = imageDownloadResult.headers['content-type'].split('/')[1];

      const writer = createWriteStream(`./${userId}.${imageFormat}`);
      imageDownloadResult.data.pipe(writer);

      writer.on('finish', async () => {
        const form = new FormData();
        form.append('user_id', userId);
        form.append('message_type', 'FILE');
        form.append('file', createReadStream(`./${userId}.${imageFormat}`));
        form.append('apns_bundle_id', 'com.cca.MyChatPlain');
        form.append('custom_type', notificationType); // For use of Laguna Chat
        // eslint-disable-next-line max-len
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

        if (result.status === 200) {
          return result.data.message_id;
        } else {
          this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalImage.name, {
            code: result.status,
            data: result.data,
          });
        }
      });
    } catch (ex) {
      this.logger.error(
        sendSendBirdNotification,
        SendBird.name,
        this.sendJournalImage.name,
        formatEx(ex),
      );
    }
  }

  async sendJournalAudio(sendSendBirdNotification: SendSendBirdNotification) {
    this.logger.info(sendSendBirdNotification, SendBird.name, this.sendJournalAudio.name);
    const {
      userId,
      sendBirdChannelUrl,
      message,
      notificationType,
      appointmentId,
      journalAudioDownloadLink,
    } = sendSendBirdNotification;
    try {
      const audioDownloadResult = await this.httpService
        .get(journalAudioDownloadLink, { responseType: 'stream' })
        .toPromise();

      const audioFormat =
        audioDownloadResult.headers['content-type'] === 'audio/mp4' ? 'm4a' : 'mp3';

      const writer = createWriteStream(`./${userId}.${audioFormat}`);
      audioDownloadResult.data.pipe(writer);

      writer.on('finish', async () => {
        const form = new FormData();
        form.append('user_id', userId);
        form.append('message_type', 'FILE');
        form.append('file', createReadStream(`./${userId}.${audioFormat}`));
        form.append('apns_bundle_id', 'com.cca.MyChatPlain');
        form.append('custom_type', notificationType); // For use of Laguna Chat
        // eslint-disable-next-line max-len
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
          this.logger.error(sendSendBirdNotification, SendBird.name, this.sendJournalAudio.name, {
            code: result.status,
            data: result.data,
          });
        }
      });
    } catch (ex) {
      this.logger.error(
        sendSendBirdNotification,
        SendBird.name,
        this.sendJournalAudio.name,
        formatEx(ex),
      );
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
          { headers: this.headers },
        )
        .toPromise();
      if (result.status === 200) {
        return result.data.message_id;
      } else {
        this.logger.error(sendSendBirdNotification, SendBird.name, this.sendAdminMessage.name, {
          code: result.status,
          data: result.data,
        });
      }
    } catch (ex) {
      this.logger.error(
        sendSendBirdNotification,
        SendBird.name,
        this.sendAdminMessage.name,
        formatEx(ex),
      );
    }
  }
}
