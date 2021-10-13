import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  CancelNotificationParams,
  Logger,
  SendOneSignalNotification,
  // SendSendbirdNotification,
  SendTwilioNotification,
} from '../common';
import { ConfigsService } from './aws';
import { OneSignal } from './oneSignal';
import { TwilioService } from './twilio.service';

@Injectable()
export class NotificationsService {
  private readonly oneSignal: OneSignal;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
    private readonly logger: Logger,
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
  }: // sendSendbirdNotification,
  {
    sendOneSignalNotification?: SendOneSignalNotification;
    sendTwilioNotification?: SendTwilioNotification;
    // sendSendbirdNotification?: SendSendbirdNotification;
  }): Promise<string> {
    if (sendOneSignalNotification) {
      this.logger.debug(sendOneSignalNotification, NotificationsService.name, this.send.name);
      return this.oneSignal.send(sendOneSignalNotification);
    }
    if (sendTwilioNotification) {
      this.logger.debug(sendTwilioNotification, NotificationsService.name, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    }
    // if (sendSendbirdNotification) {
    //   this.logger.debug(
    //     sendSendbirdNotification,
    //     NotificationsService.name,
    //     this.send.name,
    //   );
    //   return this.sendbird.send(sendSendbirdNotification);
    // }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    return this.oneSignal.cancel(cancelNotificationParams);
  }
}
