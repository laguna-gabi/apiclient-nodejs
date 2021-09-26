import { Injectable } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import {
  CancelNotificationParams,
  CancelNotificationType,
  Errors,
  ErrorType,
  NotificationType,
  Platform,
  SendNotificationToMemberParams,
} from '../common';
import { HttpService } from '@nestjs/axios';
import * as config from 'config';

@Injectable()
export class OneSignal {
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
        ...config.get('oneSignal.voipRegistrationPayload'),
      };
      const result = await this.httpService.post(this.playersUrl, data).toPromise();
      return this.validateRegisterResult(externalUserId, result);
    } catch (ex) {
      console.error(
        `Onesignal: Failure to register a user for voip project`,
        ex.response?.status,
        ex.response?.config,
      );
    }
  }

  async send(sendNotificationToMemberParams: SendNotificationToMemberParams) {
    const { platform, externalUserId, data, metadata } = sendNotificationToMemberParams;

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const extraData = this.getExtraDataByPlatform(platform);

    const body: any = {
      app_id,
      include_external_user_ids: [externalUserId],
      content_available: true,
      contents: {
        en: metadata.content,
      },
      headings: { en: 'Laguna' },
      ...extraData,
      data,
    };

    if (this.isVoipProject(platform, data.type)) {
      body.apns_push_type_override = 'voip';
    }

    try {
      const result = await this.httpService.post(this.notificationsUrl, body, config).toPromise();
      if (result.status === 200 && result.data.recipients === 1) {
        return result.data.id;
      }
    } catch (ex) {
      console.error(ex);
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    const { platform, externalUserId, data } = cancelNotificationParams;

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const cancelUrl = `${this.notificationsUrl}/${data.notificationId}?app_id=${app_id}`;

    try {
      await this.httpService.delete(cancelUrl, config).toPromise();
    } catch (ex) {
      if (ex.response.data.errors[0] !== 'Notification has already been sent to all recipients') {
        throw new Error(Errors.get(ErrorType.notificationNotFound));
      } else {
        const defaultApiKey = await this.configsService.getConfig(
          ExternalConfigs.oneSignal.defaultApiKey,
        );
        const config = { headers: { Authorization: `Basic ${defaultApiKey}` } };
        const app_id = await this.configsService.getConfig(ExternalConfigs.oneSignal.defaultApiId);

        const body: any = {
          app_id,
          include_external_user_ids: [externalUserId],
          content_available: true,
          data,
        };

        try {
          const result = await this.httpService
            .post(this.notificationsUrl, body, config)
            .toPromise();
          if (result.status === 200 && result.data.recipients === 1) {
            return result.data.id;
          }
        } catch (ex) {
          console.error(ex);
        }
      }
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
  private isVoipProject(
    platform: Platform,
    notificationType?: NotificationType | CancelNotificationType,
  ): boolean {
    return (
      platform === Platform.ios &&
      notificationType !== NotificationType.text &&
      notificationType !== CancelNotificationType.cancelText
    );
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

  private async getApiId(
    platform: Platform,
    notificationType?: NotificationType | CancelNotificationType,
  ): Promise<string> {
    return this.configsService.getConfig(
      this.isVoipProject(platform, notificationType)
        ? ExternalConfigs.oneSignal.voipApiId
        : ExternalConfigs.oneSignal.defaultApiId,
    );
  }

  private async getConfig(
    platform: Platform,
    notificationType?: NotificationType | CancelNotificationType,
  ) {
    const config = await this.configsService.getConfig(
      this.isVoipProject(platform, notificationType)
        ? ExternalConfigs.oneSignal.voipApiKey
        : ExternalConfigs.oneSignal.defaultApiKey,
    );

    return { headers: { Authorization: `Basic ${config}` } };
  }

  private getExtraDataByPlatform(platform: Platform) {
    if (platform === Platform.android) {
      return {
        android_channel_id: config.get('oneSignal.androidChannelId'),
        android_visibility: 1,
        priority: 10,
      };
    }

    return {};
  }
}
