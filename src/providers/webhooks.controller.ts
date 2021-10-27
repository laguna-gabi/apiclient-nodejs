import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TwilioService } from '.';
import { Public } from '../auth/decorators/public.decorator';
import {
  EventType,
  IEventNotifyChatMessage,
  IEventSlackMessage,
  Logger,
  SlackChannel,
  SlackIcon,
  apiPrefix,
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

  @Public()
  @Post('twilio/incoming-sms')
  async incomingSms(@Body() body) {
    if (this.twilioService.validateWebhook(body.Token)) {
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
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }
}
