import { Body, Controller, Post } from '@nestjs/common';
import { apiPrefix, EventType, IEventNotifyChatMessage, Logger, webhooks } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdPayload.json' for a payload example
 */
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(protected readonly eventEmitter: EventEmitter2) {}

  @Post(`sendbird`)
  async sendbird(@Body() payload) {
    const { user_id: senderUserId } = payload.sender;
    const { channel_url: sendbirdChannelUrl } = payload.channel;

    this.logger.debug(this.logger.getCalledLog(payload), this.sendbird.name);

    const event: IEventNotifyChatMessage = { senderUserId, sendbirdChannelUrl };
    this.eventEmitter.emit(EventType.notifyChatMessage, event);
  }
}
