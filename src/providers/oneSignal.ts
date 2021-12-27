import {
  AllNotificationTypes,
  BaseOneSignal,
  InternalNotificationType,
  Platform,
} from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { oneSignal } from 'config';
import { CancelNotificationParams, Provider, ProviderResult, SendOneSignalNotification } from '.';
import { ErrorType, Errors, Logger } from '../common';
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
      } else if (
        data.errors[0] === 'All included players are not subscribed' ||
        data.errors?.invalid_external_user_ids[0] === externalUserId
      ) {
        //TODO
        //https://app.shortcut.com/laguna-health/story/2208/hepius-iris-pandora-cleanup
        // const eventParams: IEventOnMemberBecameOffline = {
        //   phone: sendOneSignalNotification.data.member.phone,
        //   content,
        //   type: sendOneSignalNotification.data.type,
        // };
        // this.eventEmitter.emit(EventType.onMemberBecameOffline, eventParams);
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

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    this.logger.info(cancelNotificationParams, OneSignal.name, this.cancel.name);
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

        const body = {
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
          this.logger.error(cancelNotificationParams, OneSignal.name, this.cancel.name, ex);
        }
      }
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
