import { HttpService, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { BaseLogger, BaseSendBird } from '@lagunahealth/pandora';

@Injectable()
export class SendBird extends BaseSendBird implements OnModuleInit {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: BaseLogger,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    this.appId = await this.configsService.getConfig(ExternalConfigs.sendbird.apiId);
    this.appToken = await this.configsService.getConfig(ExternalConfigs.sendbird.apiToken);
    await super.onModuleInit();
  }

  //TODO replace any with class object SendSendBirdNotification
  // async send(sendSendBirdNotification: SendSendBirdNotification) {
  async send(sendSendBirdNotification: any) {
    this.logger.debug(sendSendBirdNotification, SendBird.name, this.send.name);
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
