import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { Environments, EventType, IEventNotifySlack, Logger } from '../common';

@Injectable()
export class SlackBot implements OnModuleInit {
  private url;
  private webhook;

  constructor(
    private readonly configsService: ConfigsService,
    readonly eventEmitter: EventEmitter2,
    readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(this.url);
  }

  @OnEvent(EventType.notifySlack, { async: true })
  async sendMessage(params: IEventNotifySlack) {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
      this.logger.debug(params, SlackBot.name, this.sendMessage.name);
    } else {
      try {
        await this.webhook.send({
          username: 'LagunaBot',
          icon_emoji: params.icon,
          channel: config.get(params.channel),
          attachments: [
            {
              color: '#9733EE',
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: params.message,
                  },
                },
              ],
            },
          ],
        });
      } catch (ex) {
        this.logger.error(params, SlackBot.name, this.sendMessage.name, ex);
      }
    }
  }
}
