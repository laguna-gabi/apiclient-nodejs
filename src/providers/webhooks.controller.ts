import { Body, Controller, Headers, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
 * Go to '../../test/unit/mocks/webhookSendbirdPayload.json' for a payload example
 */
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  constructor(
    protected readonly twilioService: TwilioService,
    protected readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  @Post(`sendbird`)
  async sendbird(@Body() payload) {
    const { user_id: senderUserId } = payload.sender;
    const { channel_url: sendbirdChannelUrl } = payload.channel;

    this.logger.debug(payload, WebhooksController.name, this.sendbird.name);

    const event: IEventNotifyChatMessage = { senderUserId, sendbirdChannelUrl };
    this.eventEmitter.emit(EventType.notifyChatMessage, event);
  }

  @Post('twilio/incoming-sms')
  async incomingSms(@Body() body, @Headers('X-Twilio-Signature') signature) {
    if (
      this.twilioService.validateWebhook(
        signature,
        `${apiPrefix}/${webhooks}/twilio/incoming-sms`,
        body,
      )
    ) {
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
