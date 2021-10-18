import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import {
  AllNotificationTypes,
  CancelNotificationParams,
  CancelNotificationType,
  Errors,
  ErrorType,
  InternalNotificationType,
  Logger,
  NotificationType,
  Platform,
  SendOneSignalNotification,
} from '../common';

@Injectable()
export class OneSignal {
  private readonly oneSignalUrl = 'https://onesignal.com/api/v1';
  private readonly playersUrl = `${this.oneSignalUrl}/players`;
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
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
      this.logger.error(
        { token, externalUserId },
        OneSignal.name,
        this.register.name,
        ex.response?.status,
        ex.response?.config,
      );
    }
  }

  async send(sendOneSignalNotification: SendOneSignalNotification) {
    const { platform, externalUserId, data, metadata } = sendOneSignalNotification;
    this.logger.debug(data, OneSignal.name, this.send.name);

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const extraData = this.getExtraDataByPlatform(platform);
    const onlyChatData =
      data.type === InternalNotificationType.chatMessageToMember
        ? { collapse_id: data.user.id }
        : {};

    const body: any = {
      app_id,
      include_external_user_ids: [externalUserId],
      content_available: true,
      contents: { en: metadata.content },
      headings: { en: 'Laguna' },
      ...extraData,
      ...onlyChatData,
      data,
    };

    if (this.isVoipProject(platform, data.type)) {
      body.apns_push_type_override = 'voip';
    }

    try {
      const { status, data } = await this.httpService
        .post(this.notificationsUrl, body, config)
        .toPromise();
      if (status === 200 && data.recipients >= 1) {
        return data.id;
      } else {
        this.logger.error(
          sendOneSignalNotification,
          OneSignal.name,
          this.send.name,
          status,
          JSON.stringify(data),
        );
      }
    } catch (ex) {
      this.logger.error(sendOneSignalNotification, OneSignal.name, this.send.name, ex);
    }
  }

  async cancel(params: CancelNotificationParams) {
    const { platform, externalUserId, data } = params;

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
          if (result.status === 200 && result.data.recipients >= 1) {
            return result.data.id;
          }
        } catch (ex) {
          this.logger.error(params, OneSignal.name, this.cancel.name, ex);
        }
      }
    }
  }

  /*************************************************************************************************
   **************************************** Private methods ****************************************
   ************************************************************************************************/
  private isVoipProject(platform: Platform, notificationType?: AllNotificationTypes): boolean {
    return (
      platform === Platform.ios &&
      notificationType !== NotificationType.text &&
      notificationType !== CancelNotificationType.cancelText &&
      !(notificationType in InternalNotificationType)
    );
  }

  private validateRegisterResult(externalUserId, result): string | undefined {
    const methodName = this.register.name;
    if (result.status === 200) {
      this.logger.debug({ externalUserId }, OneSignal.name, methodName);
      return result.data.id;
    } else {
      this.logger.error({ externalUserId }, OneSignal.name, methodName, result.status);
      return undefined;
    }
  }

  private async getApiId(
    platform: Platform,
    notificationType?: AllNotificationTypes,
  ): Promise<string> {
    return this.configsService.getConfig(
      this.isVoipProject(platform, notificationType)
        ? ExternalConfigs.oneSignal.voipApiId
        : ExternalConfigs.oneSignal.defaultApiId,
    );
  }

  private async getConfig(platform: Platform, notificationType?: AllNotificationTypes) {
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
