import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MobilePlatform, NotificationType, SendNotificationParams } from '../common';
import { ConfigsService, ExternalConfigs } from './aws';

@Injectable()
export class NotificationsService {
  private readonly oneSignalUrl = 'https://onesignal.com/api/v1';
  private readonly playersUrl = `${this.oneSignalUrl}/players`;
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
  ) {}

  async register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<boolean> {
    try {
      const data = {
        app_id: await this.configsService.getConfig(ExternalConfigs.oneSignalVoipApiId),
        identifier: token,
        external_user_id: externalUserId,
        device_type: 0, //ios
      };
      const result = await this.httpService.post(this.playersUrl, data).toPromise();

      if (result.status === 200) {
        console.log(
          `Onesignal: Successfully registered externalUserId ${externalUserId} for voip project`,
        );
        return true;
      } else {
        console.error(
          `Onesignal: Failure to register externalUserId 
          ${externalUserId} for voip project ${result.statusText}`,
        );
        return false;
      }
    } catch (ex) {
      console.error(
        `Onesignal: Failure to register a user for voip project`,
        ex.response?.status,
        JSON.stringify(ex.response?.config, undefined, 2),
      );
    }
  }

  async send(sendNotificationParams: SendNotificationParams) {
    const { mobilePlatform, externalUserId, notificationType, payload } = sendNotificationParams;

    let data: any = { include_external_user_ids: [externalUserId], ...payload };
    let header = 'Basic ';
    if (notificationType === NotificationType.voip && mobilePlatform === MobilePlatform.ios) {
      data = {
        ...data,
        app_id: await this.configsService.getConfig(ExternalConfigs.oneSignalVoipApiId),
        apns_push_type_override: NotificationType.voip,
      };
      header += await this.configsService.getConfig(ExternalConfigs.oneSignalVoipApiKey);
    } else {
      data = {
        ...data,
        app_id: await this.configsService.getConfig(ExternalConfigs.oneSignalDefaultApiId),
        include_external_user_ids: [externalUserId],
      };
      header += await this.configsService.getConfig(ExternalConfigs.oneSignalDefaultApiKey);
    }

    try {
      const result = await this.httpService
        .post(this.notificationsUrl, data, { headers: { Authorization: header } })
        .toPromise();
      return result.status === 200 && result.data.recipients === 1;
    } catch (ex) {
      console.error(ex);
    }
  }
}
