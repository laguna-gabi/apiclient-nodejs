import { Injectable } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { Platform, NotificationType, SendNotificationParams } from '../common';
import { HttpService } from '@nestjs/axios';
import { INotifications } from './interfaces';

@Injectable()
export class OneSignal implements INotifications {
  private readonly oneSignalUrl = 'https://onesignal.com/api/v1';
  private readonly playersUrl = `${this.oneSignalUrl}/players`;
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Supporting ONLY ios since the android registration is made by default from the client.
   */
  async register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<string | undefined> {
    try {
      const data = {
        app_id: await this.getApiId(Platform.ios),
        identifier: token,
        external_user_id: externalUserId,
        device_type: 0, //ios
      };
      const result = await this.httpService.post(this.playersUrl, data).toPromise();
      return this.validateRegisterResult(externalUserId, result);
    } catch (ex) {
      console.error(
        `Onesignal: Failure to register a user for voip project`,
        ex.response?.status,
        JSON.stringify(ex.response?.config, undefined, 2),
      );
    }
  }

  async send(sendNotificationParams: SendNotificationParams) {
    const { platform, externalUserId, payload, data } = sendNotificationParams;

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const body: any = {
      include_external_user_ids: [externalUserId],
      content_available: true,
      ...payload,
      data,
      app_id,
    };

    if (this.isVoipProject(platform, data.type)) {
      body.apns_push_type_override = 'voip';
    }

    try {
      const result = await this.httpService.post(this.notificationsUrl, body, config).toPromise();
      return result.status === 200 && result.data.recipients === 1;
    } catch (ex) {
      console.error(ex);
    }
  }

  async unregister(playerId: string, platform: Platform) {
    const appId = await this.getApiId(platform);
    const url = `${this.playersUrl}/${playerId}?app_id=${appId}`;
    const config = await this.getConfig(platform);

    await this.httpService.delete(url, config).toPromise();
  }

  /*************************************************************************************************
   **************************************** Private methods ****************************************
   ************************************************************************************************/
  private isVoipProject(platform: Platform, notificationType?: NotificationType): boolean {
    return platform === Platform.ios && notificationType !== NotificationType.text;
  }

  private validateRegisterResult(externalUserId, result): string | undefined {
    if (result.status === 200) {
      console.log(
        `Onesignal: Successfully registered externalUserId ${externalUserId} for voip project`,
      );
      return result.data.id;
    } else {
      console.error(
        `Onesignal: Failure to register externalUserId 
          ${externalUserId} for voip project ${result.statusText}`,
      );
      return undefined;
    }
  }

  private async getApiId(platform: Platform, notificationType?: NotificationType): Promise<string> {
    return this.configsService.getConfig(
      this.isVoipProject(platform, notificationType)
        ? ExternalConfigs.oneSignalVoipApiId
        : ExternalConfigs.oneSignalDefaultApiId,
    );
  }

  private async getConfig(platform: Platform, notificationType?: NotificationType) {
    const config = await this.configsService.getConfig(
      this.isVoipProject(platform, notificationType)
        ? ExternalConfigs.oneSignalVoipApiKey
        : ExternalConfigs.oneSignalDefaultApiKey,
    );

    return { headers: { Authorization: `Basic ${config}` } };
  }
}
