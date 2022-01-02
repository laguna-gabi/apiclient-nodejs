import { BaseOneSignal, InternalNotificationType, Platform, formatEx } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import {
  AllNotificationTypes,
  EventType,
  IEventOnMemberBecameOffline,
  LoggerService,
  SendOneSignalNotification,
} from '../common';
import { MemberConfig } from '../member';

@Injectable()
export class OneSignal extends BaseOneSignal implements OnModuleInit {
  private readonly playersUrl = `${this.oneSignalUrl}/players`;
  private readonly notificationsUrl = `${this.oneSignalUrl}/notifications`;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    readonly eventEmitter: EventEmitter2,
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
    this.logger.info({ token, externalUserId }, OneSignal.name, this.register.name);
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
      this.logger.error({ token, externalUserId }, OneSignal.name, this.register.name, {
        code: ex.response?.status,
        message: ex.response?.message,
        stack: ex.response?.config,
      });
    }
  }

  async unregister(memberConfig: MemberConfig): Promise<void> {
    this.logger.info(memberConfig, OneSignal.name, this.unregister.name);
    try {
      if (memberConfig.platform === Platform.ios) {
        const appId = await this.configsService.getConfig(ExternalConfigs.oneSignal.voipApiId);
        const config = await this.configsService.getConfig(ExternalConfigs.oneSignal.voipApiKey);
        await this.findAndUnregister(memberConfig, appId, config);
      }
      const appId = await this.configsService.getConfig(ExternalConfigs.oneSignal.defaultApiId);
      const config = await this.configsService.getConfig(ExternalConfigs.oneSignal.defaultApiKey);
      await this.findAndUnregister(memberConfig, appId, config);
    } catch (ex) {
      this.logger.error(memberConfig, OneSignal.name, this.unregister.name, formatEx(ex));
    }
  }

  async send(sendOneSignalNotification: SendOneSignalNotification): Promise<string | void> {
    this.logger.info(sendOneSignalNotification, OneSignal.name, this.send.name);
    const { platform, externalUserId, data, content } = sendOneSignalNotification;
    this.logger.info(data, OneSignal.name, this.send.name);

    const config = await this.getConfig(platform, data.type);
    const app_id = await this.getApiId(platform, data.type);
    const extraData = OneSignal.getExtraDataByPlatform(platform);
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
        return data.id;
      } else if (
        data.errors[0] === 'All included players are not subscribed' ||
        data.errors?.invalid_external_user_ids[0] === externalUserId
      ) {
        const eventParams: IEventOnMemberBecameOffline = {
          phone: sendOneSignalNotification.data.member.phone,
          content,
          type: sendOneSignalNotification.data.type,
        };
        this.eventEmitter.emit(EventType.onMemberBecameOffline, eventParams);
      }
      this.logger.error(sendOneSignalNotification, OneSignal.name, this.send.name, {
        code: status,
        data,
      });
    } catch (ex) {
      this.logger.error(sendOneSignalNotification, OneSignal.name, this.send.name, formatEx(ex));
    }
  }

  /*************************************************************************************************
   **************************************** Private methods ****************************************
   ************************************************************************************************/
  private validateRegisterResult(externalUserId, result): string | undefined {
    const methodName = this.register.name;
    if (result.status === 200) {
      this.logger.info({ externalUserId }, OneSignal.name, methodName);
      return result.data.id;
    } else {
      this.logger.error({ externalUserId }, OneSignal.name, methodName, {
        code: result.status,
        data: result.data,
      });
      return undefined;
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

  private static getExtraDataByPlatform(platform: Platform) {
    if (platform === Platform.android) {
      return {
        android_channel_id: config.get('oneSignal.androidChannelId'),
        android_visibility: 1,
        priority: 10,
      };
    }

    return {};
  }

  private async findAndUnregister(memberConfig, appId, config) {
    const result = await this.httpService
      .get(`${this.playersUrl}?app_id=${appId}`, {
        headers: { Authorization: `Basic ${config}` },
      })
      .toPromise();
    const [player] = result.data.players.filter(
      (member) => member.external_user_id === memberConfig.externalUserId,
    );
    if (player) {
      await this.httpService
        .delete(`${this.playersUrl}/${player.id}?app_id=${appId}`, {
          headers: { Authorization: `Basic ${config}` },
        })
        .toPromise();
    }
  }
}
