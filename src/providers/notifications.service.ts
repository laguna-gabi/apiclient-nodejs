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
  private logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
  ) {
    this.oneSignal = new OneSignal(configsService, httpService);
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
  }): Promise<boolean> {
    const methodName = this.send.name;
    if (sendNotificationToMemberParams) {
      this.logger.debug(this.logger.getCalledLog(sendNotificationToMemberParams), methodName);
      if (
        sendNotificationToMemberParams.platform === Platform.web ||
        sendNotificationToMemberParams.data.type === NotificationType.textSms ||
        !sendNotificationToMemberParams.isPushNotificationsEnabled
      ) {
        await this.twilio.send({
          body: sendNotificationToMemberParams.metadata.content,
          to: sendNotificationToMemberParams.data.member.phone,
        });
      } else {
        return this.oneSignal.send(sendNotificationToMemberParams);
      }
    }

    if (sendNotificationToUserParams) {
      this.logger.debug(this.logger.getCalledLog(sendNotificationToUserParams), methodName);
      return this.twilio.send({
        body: sendNotificationToUserParams.metadata.content,
        to: sendNotificationToUserParams.data.user.phone,
      });
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    return this.oneSignal.cancel(cancelNotificationParams);
  }

  async unregister(playerId: string, platform: Platform): Promise<void> {
    return this.oneSignal.unregister(playerId, platform);
  }
}
