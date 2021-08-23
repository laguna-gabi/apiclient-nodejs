import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { EventType, SlackIcon } from '../common';
import { ConfigsService, ExternalConfigs } from '.';

@Injectable()
export class SlackBot implements OnModuleInit {
  private url;
  private channel;
  private webhook;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slackUrl);
    if (this.url) {
      this.webhook = new IncomingWebhook(this.url);
      this.channel = config.get('slack.channel');
    }
  }

  @OnEvent(EventType.slackMessage, { async: true })
  async sendMessage({ message, icon = SlackIcon.info }: { message: string; icon: SlackIcon }) {
    if (this.url) {
      await this.webhook.send({
        username: 'LagunaBot',
        icon_emoji: icon,
        channel: this.channel,
        attachments: [
          {
            color: '#9733EE',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: message,
                },
              },
            ],
          },
        ],
      });
    }
  }
}
