import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  apiPrefix,
  EventType,
  IEventNotifyChatMessage,
  Logger,
  LoggingInterceptor,
  webhooks,
} from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { SendBird } from './sendBird';

/**
 * Go to '../../test/unit/mocks/webhookSendbirdPayloadMessageFromUser.json' for a payload example
 */
@UseInterceptors(LoggingInterceptor)
@Controller(`${apiPrefix}/${webhooks}`)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    protected sendbirdService: SendBird,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  @Post(`sendbird`)
  async sendbird(@Body() payload, @Req() request) {
    const { user_id: senderUserId } = payload.sender;
    this.validateMessageSentFromSendbird(payload, request);

    const userIds = payload.members.filter((item) => item.user_id !== senderUserId);

    if (userIds.length !== 1) {
      this.logger.error('failed to process webhook payload - users dont match', this.sendbird.name);
      return;
    }

    const event: IEventNotifyChatMessage = { senderUserId, receiverUserId: userIds[0].user_id };
    this.eventEmitter.emit(EventType.notifyChatMessage, event);
  }

  /* eslint-disable max-len */
  /**
   * we're checking that the request was sent from sendbird by parsing the header.
   * ensure that the source of the request comes from Sendbird server..
   * https://sendbird.com/docs/chat/v3/platform-api/guides/webhooks?_ga=2.74933394.1888671852.1633246669-1802902378.1627825679#2-headers-3-x-sendbird-signature
   */
  /* eslint-enable max-len */
  private validateMessageSentFromSendbird(@Body() payload, @Req() request) {
    const signature = request.headers['x-sendbird-signature'];
    console.log({ signature });

    const hash = crypto
      .createHmac('sha256', this.sendbirdService.getAppToken())
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== hash) {
      const message = 'The source of the request DID NOT comes from Sendbird server';
      this.logger.error(message, this.validateMessageSentFromSendbird.name);
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}
