import {
  GlobalEventType,
  IEventNotifySlack,
  SlackChannel,
  SlackIcon,
  webhooks,
} from '@argus/pandora';
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
import { RevAI } from '.';
import {
  EventType,
  IEventOnTranscriptFailed,
  IEventOnTranscriptTranscribed,
  LoggerService,
  LoggingInterceptor,
  revai,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Controller(`${webhooks}`)
export class WebhooksController {
  constructor(
    private readonly revAI: RevAI,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  @Post(revai)
  async transcriptComplete(@Body('job') body, @Headers('authorization') token) {
    if (this.revAI.validateWebhook(token)) {
      const { id, status, failure_detail } = body;
      if (status === 'transcribed') {
        const params: IEventOnTranscriptTranscribed = { transcriptionId: id };
        this.eventEmitter.emit(EventType.onTranscriptTranscribed, params);
      } else {
        this.logger.error(body, WebhooksController.name, this.transcriptComplete.name, {
          message: failure_detail,
        });

        const params: IEventOnTranscriptFailed = {
          transcriptionId: id,
          failureReason: failure_detail,
        };
        this.eventEmitter.emit(EventType.onTranscriptFailed, params);
      }
    } else {
      const params: IEventNotifySlack = {
        header: `*RevAI webhook*`,
        message: `request from an unknown client was made to Post ${webhooks}/${revai}`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(GlobalEventType.notifySlack, params);
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }
}
