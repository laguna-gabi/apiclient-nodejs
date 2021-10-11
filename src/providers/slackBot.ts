import { Injectable, OnModuleInit } from '@nestjs/common';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, IEventSlackMessage, Logger, Environments } from '../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class SlackBot implements OnModuleInit {
  private url;
  private webhook;

  constructor(
    private readonly configsService: ConfigsService,
    readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(this.url);
  }

  @OnEvent(EventType.slackMessage, { async: true })
  async sendMessage(params: IEventSlackMessage) {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
      this.logger.debug(
        `${config.get(params.channel)}: ${params.message}`,
        SlackBot.name,
        this.sendMessage.name,
      );
    } else {
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
    }
  }
}
