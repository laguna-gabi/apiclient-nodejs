import { BaseLogger } from '../baseLogger';
import { IncomingWebhook } from '@slack/webhook';
import { OnModuleInit } from '@nestjs/common';
import { Environments } from '..';

export enum SlackChannel {
  support = 'slack.support',
  testingSms = 'slack.testingSms',
  notifications = 'slack.notifications',
  escalation = 'slack.escalation',
  analyticsAutoLoader = 'slack.analyticsAutoLoader',
}

export enum SlackIcon {
  phone = ':telephone_receiver:',
  info = ':information_source:',
  warning = ':warning:',
  critical = ':no_entry:',
  exclamationPoint = ':exclamation:',
  questionMark = ':question:',
}

export interface IEventNotifySlack {
  header: string;
  message: string;
  icon: SlackIcon;
  channel: SlackChannel;
  orgName?: string;
}

export abstract class BaseSlack implements OnModuleInit {
  protected webhook: IncomingWebhook;

  protected constructor(readonly logger: BaseLogger) {}

  abstract onModuleInit(): Promise<void>;

  async send(params: IEventNotifySlack): Promise<{ text: string }> {
    if (
      process.env.NODE_ENV === Environments.develop ||
      process.env.NODE_ENV === Environments.production
    ) {
      try {
        const orgName = `${params.orgName ? ` [${params.orgName}] ` : ''}`;
        const text = `${params.header}${orgName}\n${params.message}`;
        return this.webhook.send({
          username: 'LagunaBot',
          icon_emoji: params.icon,
          channel: params.channel,
          attachments: [
            {
              color: '#9733EE',
              blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
            },
          ],
        });
      } catch (ex) {
        this.logger.error(params, BaseSlack.name, this.send.name, ex);
      }
    } else {
      this.logger.info(params, BaseSlack.name, this.send.name);
    }
    return { text: undefined };
  }
}
