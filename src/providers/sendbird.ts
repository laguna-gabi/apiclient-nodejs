import { BaseSendBird, CustomKey, FailureReason, formatEx } from '@lagunahealth/pandora';
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
import { LoggerService, generateCustomErrorMessage } from '../common';

export type RequestType = 'admin' | 'journalText' | 'journalImage' | 'journalAudio';

@Injectable()
export class SendBird extends BaseSendBird implements OnModuleInit {
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
    await super.onModuleInit();
  }

  async send(params: SendSendBirdNotification): Promise<ProviderResult> {
    this.logger.info(params, SendBird.name, this.send.name);
    const { journalImageDownloadLink, journalAudioDownloadLink, contentKey } = params;

    const results: ProviderResult[] = [];
    if (contentKey === CustomKey.journalContent) {
      if (journalImageDownloadLink) {
        const result = await this.sendJournalImage(params);
        results.push(this.formatMessageByType('journalImage', result));
      } else {
        const result = await this.sendJournalText(params);
        results.push(this.formatMessageByType('journalText', result));
      }
      if (journalAudioDownloadLink) {
        const result = await this.sendJournalAudio(params);
        results.push(this.formatMessageByType('journalAudio', result));
      }
    } else {
      const result = await this.sendAdminMessage(params);
      results.push(this.formatMessageByType('admin', result));
    }

    return {
      provider: Provider.sendbird,
      content: results.map((result) => result.content).join(', '),
      id: results.map((result) => result.id).join(', '),
    };
  }

  async sendJournalText(params: SendSendBirdNotification): Promise<ProviderResult> {
    this.logger.info(params, SendBird.name, this.sendJournalText.name);
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } = params;
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
      return this.parseResult(params, result, this.sendJournalText.name);
    } catch (ex) {
      this.logger.error(params, SendBird.name, this.sendJournalText.name, formatEx(ex));
      throw ex;
    }
  }

  async sendJournalImage(params: SendSendBirdNotification): Promise<ProviderResult> {
    const imageDownloadResult = await this.httpService
      .get(params.journalImageDownloadLink, { responseType: 'stream' })
      .toPromise();

    const imageFormat = imageDownloadResult.headers['content-type'].split('/')[1];

    return this.sendFile(
      params,
      `./${params.userId}.${imageFormat}`,
      imageDownloadResult,
      this.sendJournalImage.name,
    );
  }

  async sendJournalAudio(params: SendSendBirdNotification): Promise<ProviderResult> {
    const audioDownloadResult = await this.httpService
      .get(params.journalAudioDownloadLink, { responseType: 'stream' })
      .toPromise();

    const audioFormat = audioDownloadResult.headers['content-type'] === 'audio/mp4' ? 'm4a' : 'mp3';

    return this.sendFile(
      params,
      `./${params.userId}.${audioFormat}`,
      audioDownloadResult,
      this.sendJournalAudio.name,
    );
  }

  async sendAdminMessage(params: SendSendBirdNotification): Promise<ProviderResult> {
    this.logger.info(params, SendBird.name, this.sendAdminMessage.name);
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } = params;
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
      return this.parseResult(params, result, this.sendAdminMessage.name);
    } catch (ex) {
      this.logger.error(params, SendBird.name, this.sendAdminMessage.name, formatEx(ex));
      throw ex;
    }
  }

  private async sendFile(
    params: SendSendBirdNotification,
    fileName: string,
    pipeResult,
    functionName: string,
  ): Promise<ProviderResult> {
    this.logger.info(params, SendBird.name, functionName);
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } = params;

    return new Promise(async (resolve, reject) => {
      try {
        const writer = createWriteStream(fileName);
        pipeResult.data.pipe(writer);

        writer.on('finish', async () => {
          const form = new FormData();
          form.append('user_id', userId);
          form.append('message_type', 'FILE');
          form.append('file', createReadStream(fileName));
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
                  'Content-Type': `multipart/form-data; boundary=${pipeResult.headers['content-type']}`,
                },
              },
            )
            .toPromise();

          await unlink(fileName);

          if (result.status === 200) {
            resolve({
              provider: Provider.sendbird,
              content: message,
              id: result.data.message_id.toString(),
            });
          } else {
            this.logger.error(params, SendBird.name, functionName, {
              code: result.status,
              data: result.data,
            });
            reject(generateCustomErrorMessage(SendBird.name, functionName, result));
          }
        });
      } catch (ex) {
        const message: FailureReason = formatEx(ex);
        this.logger.error(params, SendBird.name, functionName, message);
        reject(`failed to send to ${SendBird.name}: ${message}`);
      }
    });
  }

  private formatMessageByType(requestType: RequestType, result: ProviderResult): ProviderResult {
    return {
      provider: result.provider,
      content: `${requestType}: ${result.content}`,
      id: `${requestType}Id: ${result.id}`,
    };
  }

  private parseResult(
    params: SendSendBirdNotification,
    result,
    functionName: string,
  ): ProviderResult {
    if (result.status === 200) {
      return {
        provider: Provider.sendbird,
        content: params.message,
        id: result.data.message_id.toString(),
      };
    } else {
      this.logger.error(params, SendBird.name, functionName, {
        code: result.status,
        data: result.data,
      });
      throw new Error(generateCustomErrorMessage(SendBird.name, functionName, result));
    }
  }
}
