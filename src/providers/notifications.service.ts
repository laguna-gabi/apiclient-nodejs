import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  CancelNotificationParams,
  Logger,
  NotificationType,
  Platform,
  SendNotificationToMemberParams,
  SendNotificationToUserParams,
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
    sendNotificationToMemberParams,
    sendNotificationToUserParams,
  }: {
    sendNotificationToMemberParams?: SendNotificationToMemberParams;
    sendNotificationToUserParams?: SendNotificationToUserParams;
  }): Promise<string> {
    const methodName = this.send.name;
    if (sendNotificationToMemberParams) {
      this.logger.debug(sendNotificationToMemberParams, NotificationsService.name, methodName);
      const { platform, isPushNotificationsEnabled, data, metadata } =
        sendNotificationToMemberParams;

      switch (data.type) {
        case NotificationType.textSms:
          await this.twilio.send({ body: metadata.content, to: data.member.phone });
          break;
        case NotificationType.chat:
          if (platform !== Platform.web && isPushNotificationsEnabled) {
            return this.oneSignal.send(sendNotificationToMemberParams);
          }
          break;
        default:
          if (platform !== Platform.web && isPushNotificationsEnabled) {
            return this.oneSignal.send(sendNotificationToMemberParams);
          } else {
            await this.twilio.send({ body: metadata.content, to: data.member.phone });
          }
          break;
      }
    }

    if (sendNotificationToUserParams) {
      this.logger.debug(sendNotificationToUserParams, NotificationsService.name, methodName);
      await this.twilio.send({
        body: sendNotificationToUserParams.metadata.content,
        to: sendNotificationToUserParams.data.user.phone,
      });
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    return this.oneSignal.cancel(cancelNotificationParams);
  }
}
