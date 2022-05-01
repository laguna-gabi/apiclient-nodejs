import { webhooks } from '@argus/pandora';
import { Body, Controller, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EventType,
  IEventOnTranscriptFailed,
  IEventOnTranscriptTranscribed,
  LoggerService,
} from '../common';

@Controller(`${webhooks}`)
export class WebhooksController {
  constructor(
    protected readonly eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  @Post(`revAI`)
  async revAI(@Body('job') body) {
    const { id, status, failure, failure_detail } = body;

    if (status === 'transcribed') {
      const params: IEventOnTranscriptTranscribed = { transcriptionId: id };
      this.eventEmitter.emit(EventType.onTranscriptTranscribed, params);
    } else {
      this.logger.error(body, WebhooksController.name, this.revAI.name, {
        code: failure,
        message: failure_detail,
      });

      const params: IEventOnTranscriptFailed = {
        transcriptionId: id,
        failureReason: failure_detail,
      };
      this.eventEmitter.emit(EventType.onTranscriptFailed, params);
    }
  }
}
