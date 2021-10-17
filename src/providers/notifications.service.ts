import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import {
  CancelNotificationParams,
  Logger,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { SendBird } from './sendBird';
import { TwilioService } from './twilio.service';
import { ConfigsService, OneSignal } from '.';

@Injectable()
export class NotificationsService {
  private readonly oneSignal: OneSignal;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
    private readonly sendBird: SendBird,
    private readonly logger: Logger,
    private readonly sendbird: SendBird,
  ) {
    this.oneSignal = new OneSignal(configsService, httpService, logger);
  }

  async register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<string | undefined> {
    return this.oneSignal.register({ token, externalUserId });
  }

  async send({
    sendOneSignalNotification,
    sendTwilioNotification,
    sendSendBirdNotification,
  }: {
    sendOneSignalNotification?: SendOneSignalNotification;
    sendTwilioNotification?: SendTwilioNotification;
    sendSendBirdNotification?: SendSendBirdNotification;
  }): Promise<string> {
    if (sendOneSignalNotification) {
      this.logger.debug(sendOneSignalNotification, NotificationsService.name, this.send.name);
      return this.oneSignal.send(sendOneSignalNotification);
    }
    if (sendTwilioNotification) {
      this.logger.debug(sendTwilioNotification, NotificationsService.name, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    }
    if (sendSendBirdNotification) {
      this.logger.debug(sendSendBirdNotification, NotificationsService.name, this.send.name);
      return this.sendbird.send(sendSendBirdNotification);
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    return this.oneSignal.cancel(cancelNotificationParams);
  }
}
