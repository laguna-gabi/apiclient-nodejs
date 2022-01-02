import {
  AllNotificationTypes,
  BaseOneSignal,
  InternalNotificationType,
  Platform,
  formatEx,
} from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { oneSignal } from 'config';
import { CancelNotificationParams, Provider, ProviderResult, SendOneSignalNotification } from '.';
import { Logger } from '../common';
import { ConfigsService, ExternalConfigs } from './aws';

@Injectable()
export class OneSignal extends BaseOneSignal implements OnModuleInit {
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
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

  async send(sendOneSignalNotification: SendOneSignalNotification): Promise<ProviderResult> {
    this.logger.info(sendOneSignalNotification, OneSignal.name, this.send.name);
    const { platform, externalUserId, data, content } = sendOneSignalNotification;
    this.logger.info(data, OneSignal.name, this.send.name);

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
      contents: { en: content },
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
        return { provider: Provider.oneSignal, content: body.contents.en, id: data.id };
      } else {
        this.logger.error(sendOneSignalNotification, OneSignal.name, this.send.name, {
          code: status,
          data,
        });
      }
    } catch (ex) {
      this.logger.error(sendOneSignalNotification, OneSignal.name, this.send.name, formatEx(ex));
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
      }
    } catch (ex) {
      this.logger.error(cancelNotificationParams, OneSignal.name, this.cancel.name, formatEx(ex));
    }
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
        android_channel_id: oneSignal.androidChannelId,
        android_visibility: 1,
        priority: 10,
      };
    }

    return {};
  }
}
