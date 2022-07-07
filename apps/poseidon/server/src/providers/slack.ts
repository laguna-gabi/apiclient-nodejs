import { BaseSlack, GlobalEventType, IEventNotifySlack } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService } from '../common';

@Injectable()
export class Slack extends BaseSlack implements OnModuleInit {
  constructor(private readonly configsService: ConfigsService, readonly logger: LoggerService) {
    super(logger);
  }

  async onModuleInit(): Promise<void> {
    const url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(url || '');
  }

  @OnEvent(GlobalEventType.notifySlack, { async: true })
  async send(params: IEventNotifySlack) {
    return super.send({ ...params, channel: config.get(params.channel) });
  }
}
