import { Environments, formatEx } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import VoximplantApiClient from '@voximplant/apiclient-nodejs';
import * as crypto from 'crypto';
import { writeFileSync } from 'fs';
import { nanoid } from 'nanoid';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, IEventOnNewUser, IEventOnUpdateUserConfig, LoggerService } from '../common';

@Injectable()
export class Voximplant implements OnModuleInit {
  private tokenDir = './voximplentToken.json';
  private client: VoximplantApiClient;
  private applicationName: string;
  private applicationId: number;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly logger: LoggerService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = await this.configsService.getConfig(ExternalConfigs.voximplant.token);
    writeFileSync(this.tokenDir, token);
    this.client = new VoximplantApiClient(this.tokenDir);

    this.applicationName = await this.configsService.getConfig(
      ExternalConfigs.voximplant.applicationName,
    );
    this.applicationId = parseInt(
      await this.configsService.getConfig(ExternalConfigs.voximplant.applicationId),
    );
  }

  @OnEvent(EventType.onNewUser, { async: true })
  async handleNewUser(params: IEventOnNewUser) {
    this.logger.info({ userId: params.user.id }, Voximplant.name, this.handleNewUser.name);
    try {
      if (
        process.env.NODE_ENV === Environments.production ||
        process.env.NODE_ENV === Environments.develop
      ) {
        const { user } = params;
        const voximplantPassword = nanoid();
        const { userId: voximplantId } = await this.client.Users.addUser({
          userName: user.id,
          userDisplayName: `${user.firstName} ${user.lastName}`,
          userPassword: voximplantPassword,
          applicationName: this.applicationName,
          applicationId: this.applicationId,
          mobilePhone: user.phone,
        });
        const eventParams: IEventOnUpdateUserConfig = {
          userId: user.id,
          voximplantId,
          voximplantPassword,
        };
        this.eventEmitter.emit(EventType.onUpdatedUserConfig, eventParams);
      }
    } catch (ex) {
      this.logger.error(
        { userId: params.user.id },
        Voximplant.name,
        this.handleNewUser.name,
        formatEx(ex),
      );
    }
  }

  generateToken({
    userName,
    userPassword,
    key,
  }: {
    userName: string;
    userPassword: string;
    key: string;
  }) {
    let md5 = crypto.createHash('md5');
    const hash = md5.update(`${userName}:voximplant.com:${userPassword}`).digest('hex');
    md5 = crypto.createHash('md5');
    return md5.update(`${key}\|${hash}`).digest('hex');
  }
}
