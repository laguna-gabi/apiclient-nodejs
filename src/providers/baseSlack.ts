import { BaseLogger } from '../baseLogger';
import { IncomingWebhook } from '@slack/webhook';
import { Environments } from '../enums';
import { IEventNotifySlack } from '../interfaces';

export abstract class BaseSlack {
  protected webhook: IncomingWebhook;

  constructor(readonly logger: BaseLogger) {}

  abstract onModuleInit(): Promise<void>;

  async send(params: IEventNotifySlack) {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === Environments.test) {
      this.logger.info(params, BaseSlack.name, this.send.name);
    } else {
      try {
        return this.webhook.send({
          username: 'LagunaBot',
          icon_emoji: params.icon,
          channel: params.channel,
          attachments: [
            {
              color: '#9733EE',
              blocks: [{ type: 'section', text: { type: 'mrkdwn', text: params.message } }],
            },
          ],
        });
      } catch (ex) {
        this.logger.error(params, BaseSlack.name, this.send.name, ex);
      }
    }
  }
}
