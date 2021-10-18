import { Body, Controller, Headers, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Public } from '../auth/decorators/public.decorator';
import { TwilioService } from '.';
import {
  apiPrefix,
  EventType,
  IEventNotifyChatMessage,
  IEventSlackMessage,
  Logger,
  SlackChannel,
  SlackIcon,
  webhooks,
} from '../common';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdNewMessagePayload.json' for a payload example
 */
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  constructor(
    protected readonly twilioService: TwilioService,
    protected readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  @Public()
  @Post(`sendbird`)
  async sendbird(@Body() payload) {
    this.logger.debug(payload, WebhooksController.name, this.sendbird.name);

    // If there's no sender, it's an admin message (and we don't want to notify)
    if (payload.sender) {
      const { user_id: senderUserId } = payload.sender;

      const { channel_url: sendBirdChannelUrl } = payload.channel;

      const event: IEventNotifyChatMessage = { senderUserId, sendBirdChannelUrl };
      this.eventEmitter.emit(EventType.notifyChatMessage, event);
    }
  }

  @Post('twilio/incoming-sms')
  async incomingSms(@Body() body, @Headers('X-Twilio-Signature') signature) {
    if ('From' in body && 'Body' in body && signature) {
      this.logger.debug(body, WebhooksController.name, this.incomingSms.name);

      this.eventEmitter.emit(EventType.sendSmsToChat, {
        phone: body.From,
        message: body.Body,
      });
    } else {
      const params: IEventSlackMessage = {
        // eslint-disable-next-line max-len
        message: `*TWILIO WEBHOOK*\nrequest from an unknown client was made to Post ${apiPrefix}/${webhooks}/twilio/incoming-sms`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(EventType.slackMessage, params);
    }
  }
}
