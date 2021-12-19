import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, Logger } from '../common';
import { BaseSlack, IEventNotifySlack } from '@lagunahealth/pandora';
import * as config from 'config';

@Injectable()
export class SlackBot extends BaseSlack implements OnModuleInit {
  constructor(private readonly configsService: ConfigsService, readonly logger: Logger) {
    super(logger);
  }

  async onModuleInit(): Promise<void> {
    const url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(url);
  }

  @OnEvent(EventType.notifySlack, { async: true })
  async send(params: IEventNotifySlack) {
    return super.send({ ...params, channel: config.get(params.channel) });
  }
}
