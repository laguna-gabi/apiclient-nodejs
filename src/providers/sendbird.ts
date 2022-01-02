import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ConfigsService,
  ExternalConfigs,
  Provider,
  ProviderResult,
  SendSendBirdNotification,
} from '.';
import { BaseSendBird, formatEx } from '@lagunahealth/pandora';
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
    const { userId, sendBirdChannelUrl, message, notificationType, appointmentId } =
      sendSendBirdNotification;
    const methodName = this.send.name;
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
        this.logger.info(sendSendBirdNotification, SendBird.name, methodName);
        return { provider: Provider.sendbird, content: message, id: result.data.message_id };
      } else {
        this.logger.error(sendSendBirdNotification, SendBird.name, methodName, {
          code: result.status,
          data: result.data,
        });
      }
    } catch (ex) {
      this.logger.error(sendSendBirdNotification, SendBird.name, methodName, formatEx(ex));
    }
  }
}
