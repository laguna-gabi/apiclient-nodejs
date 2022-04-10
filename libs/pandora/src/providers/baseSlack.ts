import { BaseLogger } from '../baseLogger';
import { IncomingWebhook } from '@slack/webhook';
import { Environments } from '../enums';
import { IEventNotifySlack } from '../interfaces';

export abstract class BaseSlack {
  protected webhook: IncomingWebhook;

  constructor(readonly logger: BaseLogger) {}

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
