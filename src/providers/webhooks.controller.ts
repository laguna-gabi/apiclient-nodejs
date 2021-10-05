import { Body, Controller, Post } from '@nestjs/common';
import { apiPrefix, EventType, IEventNotifyChatMessage, Logger, webhooks } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdPayloadMessageFromUser.json' for a payload example
 */
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(protected readonly eventEmitter: EventEmitter2) {}

  @Post(`sendbird`)
  async sendbird(@Body() body) {
    const { user_id: senderUserId } = body.sender;

    const userIds = body.members.filter((item) => item.user_id !== senderUserId);

    if (userIds.length !== 1) {
      this.logger.error('failed to process webhook payload - users dont match', this.sendbird.name);
      return;
    }

    const event: IEventNotifyChatMessage = { senderUserId, receiverUserId: userIds[0].user_id };
    this.eventEmitter.emit(EventType.notifyChatMessage, event);

    this.logger.log(this.logger.getCalledLog(body), this.sendbird.name);
  }
}
