import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { NotificationType, Platform, SendNotificationParams } from '../common';
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

  async send(sendNotificationParams: SendNotificationParams): Promise<boolean> {
    if (
      sendNotificationParams.platform === Platform.web ||
      sendNotificationParams.data.type === NotificationType.forceSms
    ) {
      return this.twilio.send({
        body: sendNotificationParams.metadata.content,
        to: sendNotificationParams.data.member.phone,
      });
    } else {
      return this.oneSignal.send(sendNotificationParams);
    }
  }

  async unregister(playerId: string, platform: Platform): Promise<void> {
    return this.oneSignal.unregister(playerId, platform);
  }
}
