import { Injectable, OnModuleInit } from '@nestjs/common';
import { IncomingWebhook } from '@slack/webhook';
import { ConfigsService, ExternalConfigs } from '.';
import { BaseLogger, BaseSlack, IEventNotifySlack } from '@lagunahealth/pandora';
import * as config from 'config';

@Injectable()
export class Slack extends BaseSlack implements OnModuleInit {
  constructor(private readonly configsService: ConfigsService, readonly logger: BaseLogger) {
    super(logger);
  }

  async onModuleInit(): Promise<void> {
    const url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(url);
  }

  async send(params: IEventNotifySlack) {
    await super.send({ ...params, channel: config.get(params.channel) });
  }
}
