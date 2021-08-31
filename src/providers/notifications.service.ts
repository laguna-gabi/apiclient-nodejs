import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Platform, SendNotificationParams } from '../common';
import { ConfigsService } from './aws';
import { OneSignal } from './oneSignal';
import { TwilioService } from './twilio.service';
import { INotifications } from './interfaces';

@Injectable()
export class NotificationsService implements INotifications {
  private readonly oneSignal: OneSignal;
  private readonly twilio: TwilioService;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
  ) {
    this.oneSignal = new OneSignal(configsService, httpService);
    this.twilio = new TwilioService(configsService);
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
    if (sendNotificationParams.platform) {
      return this.oneSignal.send(sendNotificationParams);
    } else {
      return this.twilio.send(sendNotificationParams);
    }
  }

  async unregister(playerId: string, platform: Platform): Promise<void> {
    return this.oneSignal.unregister(playerId, platform);
  }
}
