import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SendBird, TwilioService } from '.';
import * as crypto from 'crypto';
import {
  EventType,
  IEventOnReceivedChatMessage,
  IEventOnReceivedTextMessage,
  LoggerService,
  LoggingInterceptor,
  Public,
  apiPrefix,
  webhooks,
} from '../common';
import { IEventNotifySlack, SlackChannel, SlackIcon } from '@lagunahealth/pandora';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdNewMessagePayload.json' for a payload example
 */
@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  constructor(
    protected sendbirdService: SendBird,
    protected readonly twilioService: TwilioService,
    protected readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  @Public()
  @Post(`sendbird`)
  async sendbird(@Body() payload, @Headers() headers) {
    this.validateMessageSentFromSendbird(payload, headers);

    const parsedBody = JSON.parse(payload);

    this.logger.info(
      { sender: parsedBody.sender?.user_id, channel: parsedBody.channel.channel_url },
      WebhooksController.name,
      this.sendbird.name,
    );

    // If there's no sender, it's an admin message (and we don't want to notify)
    if (parsedBody.sender) {
      const { user_id: senderUserId } = parsedBody.sender;

      const { channel_url: sendBirdChannelUrl } = parsedBody.channel;

      const event: IEventOnReceivedChatMessage = {
        senderUserId,
        sendBirdChannelUrl,
      };
      this.eventEmitter.emit(EventType.onReceivedChatMessage, event);
    }
  }

  @Public()
  @Post('twilio/incoming-sms')
  async incomingSms(@Body() body) {
    if (this.twilioService.validateWebhook(body.Token)) {
      const eventParams: IEventOnReceivedTextMessage = {
        phone: body.From,
        message: body.Body,
      };
      this.eventEmitter.emit(EventType.onReceivedTextMessage, eventParams);
    } else {
      const params: IEventNotifySlack = {
        header: `*Twilio webhook*`,
        // eslint-disable-next-line max-len
        message: `request from an unknown client was made to Post ${apiPrefix}/${webhooks}/twilio/incoming-sms`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(EventType.notifySlack, params);
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * we're checking that the request was sent from sendbird by parsing the header.
   * ensure that the source of the request comes from Sendbird server..
   * https://sendbird.com/docs/chat/v3/platform-api/guides/webhooks?_ga=2.74933394.1888671852.1633246669-1802902378.1627825679#2-headers-3-x-sendbird-signature
   */
  validateMessageSentFromSendbird(@Body() payload, @Headers() headers) {
    const signature = headers['x-sendbird-signature'];

    const hash = crypto
      .createHmac('sha256', this.sendbirdService.getMasterAppToken())
      .update(payload.toString())
      .digest('hex');

    if (signature !== hash) {
      const message = 'The source of the request DID NOT comes from Sendbird server';

      this.logger.error({}, WebhooksController.name, this.validateMessageSentFromSendbird.name, {
        message,
      });
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
