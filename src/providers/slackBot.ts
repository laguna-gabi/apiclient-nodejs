import { Injectable, OnModuleInit } from '@nestjs/common';
import { IncomingWebhook } from '@slack/webhook';
import * as config from 'config';
import { ConfigsService, environments, ExternalConfigs } from '.';
import { Logger, slackChannel, SlackIcon } from '../common';

export interface SlackMessageParams {
  message: string;
  icon: SlackIcon;
  channel: slackChannel;
}

@Injectable()
export class SlackBot implements OnModuleInit {
  private readonly logger = new Logger(SlackBot.name);
  private url;
  private webhook;

  constructor(private readonly configsService: ConfigsService) {}

  async onModuleInit(): Promise<void> {
    this.url = await this.configsService.getConfig(ExternalConfigs.slack.url);
    this.webhook = new IncomingWebhook(this.url);
  }

  async sendMessage(params: SlackMessageParams) {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === environments.test) {
      this.logger.debug(`${config.get(params.channel)}: ${params.message}`, this.sendMessage.name);
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
