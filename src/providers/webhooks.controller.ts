import { Body, Controller, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { apiPrefix, EventType, IEventNotifyChatMessage, Logger, webhooks } from '../common';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdPayload.json' for a payload example
 */
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  constructor(protected readonly eventEmitter: EventEmitter2, private readonly logger: Logger) {}

  @Post(`sendbird`)
  async sendbird(@Body() payload) {
    const { user_id: senderUserId } = payload.sender;
    const { channel_url: sendbirdChannelUrl } = payload.channel;

    this.logger.debug(payload, WebhooksController.name, this.sendbird.name);

    const event: IEventNotifyChatMessage = { senderUserId, sendbirdChannelUrl };
    this.eventEmitter.emit(EventType.notifyChatMessage, event);
  }
}
