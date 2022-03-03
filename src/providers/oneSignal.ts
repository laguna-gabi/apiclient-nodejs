import { BaseOneSignal, Platform, formatEx } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { oneSignal } from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService } from '../common';
import { MemberConfig } from '../member';

@Injectable()
export class OneSignal extends BaseOneSignal implements OnModuleInit {
  private readonly playersUrl = `${this.oneSignalUrl}/players`;

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
        ...oneSignal.voipRegistrationPayload,
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
