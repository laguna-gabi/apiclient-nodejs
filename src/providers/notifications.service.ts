import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  NotificationType,
  Platform,
  CancelNotificationParams,
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
    if (sendNotificationToMemberParams) {
      if (
        sendNotificationToMemberParams.platform === Platform.web ||
        sendNotificationToMemberParams.data.type === NotificationType.textSms
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
