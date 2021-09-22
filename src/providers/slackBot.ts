import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, IEventSlackMessage } from '../common';

@Injectable()
export class SlackBot implements OnModuleInit {
  private url;
  private webhook;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(this.url);
  }

  @OnEvent(EventType.slackMessage, { async: true })
  async sendMessage(params: IEventSlackMessage) {
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
