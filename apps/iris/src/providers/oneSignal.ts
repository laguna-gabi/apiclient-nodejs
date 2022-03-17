import {
  BaseOneSignal,
  CancelNotificationType,
  ChatInternalKey,
  NotificationType,
  Platform,
  formatEx,
} from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { oneSignal } from 'config';
import { CancelNotificationParams, Provider, ProviderResult, SendOneSignalNotification } from '.';
import { LoggerService, generateCustomErrorMessage } from '../common';
import { ConfigsService, ExternalConfigs } from './aws';

@Injectable()
export class OneSignal extends BaseOneSignal implements OnModuleInit {
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {
    super();
  }

  async onModuleInit() {
    this.defaultApiId = await this.configsService.getConfig(ExternalConfigs.oneSignal.defaultApiId);
    this.defaultApiKey = await this.configsService.getConfig(
      ExternalConfigs.oneSignal.defaultApiKey,
    );
    this.voipApiId = await this.configsService.getConfig(ExternalConfigs.oneSignal.voipApiId);
    this.voipApiKey = await this.configsService.getConfig(ExternalConfigs.oneSignal.voipApiKey);
  }

  async send(
    sendOneSignalNotification: SendOneSignalNotification,
    correlationId: string,
  ): Promise<ProviderResult> {
    this.logger.info(
      { ...sendOneSignalNotification, correlationId },
      OneSignal.name,
      this.send.name,
    );
    const { platform, externalUserId, data, content } = sendOneSignalNotification;
    this.logger.info(data, OneSignal.name, this.send.name);

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const extraData = this.getExtraDataByPlatform(platform);
    const collapseOnClient =
      data.contentKey === ChatInternalKey.newChatMessageFromUser
        ? { collapse_id: data.user.id }
        : {};

    const apnsPushTypeOverrideObject = this.isVoipProject(platform, data.type)
      ? { apns_push_type_override: 'voip' }
      : {};
    const body = {
      app_id,
      include_external_user_ids: [externalUserId],
      content_available: true,
      contents: { en: content },
      headings: { en: 'Laguna' },
      ...extraData,
      ...collapseOnClient,
      data,
      ...apnsPushTypeOverrideObject,
    };

    try {
      const result = await this.httpService.post(this.notificationsUrl, body, config).toPromise();
      if (result.status === 200 && result.data.recipients >= 1) {
        return { provider: Provider.oneSignal, content: body.contents.en, id: result.data.id };
      } else {
        this.logger.error(
          { ...sendOneSignalNotification, correlationId },
          OneSignal.name,
          this.send.name,
          { code: result.status },
        );
        throw new Error(generateCustomErrorMessage(OneSignal.name, this.send.name, result));
      }
    } catch (ex) {
      this.logger.error(
        { ...sendOneSignalNotification, correlationId },
        OneSignal.name,
        this.send.name,
        formatEx(ex),
      );
      throw ex;
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams): Promise<ProviderResult> {
    this.logger.info(cancelNotificationParams, OneSignal.name, this.cancel.name);
    const { platform, externalUserId, data } = cancelNotificationParams;

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);

    const body = {
      app_id,
      include_external_user_ids: [externalUserId],
      content_available: true,
      data,
    };

    try {
      const result = await this.httpService.post(this.notificationsUrl, body, config).toPromise();
      if (result.status === 200 && result.data.recipients >= 1) {
        return { provider: Provider.oneSignal, content: data.peerId, id: result.data.id };
      } else {
        throw new Error(generateCustomErrorMessage(OneSignal.name, this.cancel.name, result));
      }
    } catch (ex) {
      this.logger.error(cancelNotificationParams, OneSignal.name, this.cancel.name, formatEx(ex));
      throw ex;
    }
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
        android_channel_id: oneSignal.androidChannelId,
        android_visibility: 1,
        priority: 10,
      };
    }

    return {};
  }
}
