import { Body, Controller, Headers, HttpException, HttpStatus, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { SendBird, TwilioService } from '.';
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
    protected sendbirdService: SendBird,
    protected readonly twilioService: TwilioService,
    protected readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
  ) {}

  @Public()
  @Post(`sendbird`)
  async sendbird(@Body() payload, @Headers() headers) {
    this.validateMessageSentFromSendbird(payload, headers);

    const rawBody = payload.toString();
    this.logger.debug({ rawBody, headers }, WebhooksController.name, this.sendbird.name, false);

    const body = JSON.parse(payload.toString());

    // If there's no sender, it's an admin message (and we don't want to notify)
    if (body.sender) {
      const { user_id: senderUserId } = body.sender;

      const { channel_url: sendBirdChannelUrl } = body.channel;

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

  /* eslint-disable max-len */
  /**
   * we're checking that the request was sent from sendbird by parsing the header.
   * ensure that the source of the request comes from Sendbird server..
   * https://sendbird.com/docs/chat/v3/platform-api/guides/webhooks?_ga=2.74933394.1888671852.1633246669-1802902378.1627825679#2-headers-3-x-sendbird-signature
   */
  /* eslint-enable max-len */
  validateMessageSentFromSendbird(@Body() payload, @Headers() headers) {
    const signature = headers['x-sendbird-signature'];
    console.log({ signature });

    const hash = crypto
      .createHmac('sha256', this.sendbirdService.getMasterAppToken())
      .update(payload.toString().replace(/\//g, '\\/'))
      .digest('hex');

    if (signature !== hash) {
      const message = 'The source of the request DID NOT comes from Sendbird server';
      this.logger.error(
        {},
        WebhooksController.name,
        this.validateMessageSentFromSendbird.name,
        message,
      );
      // throw new HttpException(message, HttpStatus.BAD_REQUEST); // stay in debug mode for now..
    }
  }
}
