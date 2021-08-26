import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, ExternalConfigs } from '.';
import { EventType, slackChannel, SlackIcon } from '../common';

@Injectable()
export class SlackBot implements OnModuleInit {
  private url;
  private webhook;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slackUrl);
    this.webhook = new IncomingWebhook(this.url);
  }

  @OnEvent(EventType.slackMessage, { async: true })
  async sendMessage({
    message,
    icon = SlackIcon.info,
    channel = slackChannel.notifications,
  }: {
    message: string;
    icon: SlackIcon;
    channel: slackChannel;
  }) {
    await this.webhook.send({
      username: 'LagunaBot',
      icon_emoji: icon,
      channel: config.get(channel),
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
