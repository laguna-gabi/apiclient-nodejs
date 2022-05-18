import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db';
import { dbConnect, dbDisconnect } from '..';
import {
  EventType,
  IEventOnTranscriptFailed,
  IEventOnTranscriptTranscribed,
  LoggerService,
} from '../../src/common';
import { WebhooksController } from '../../src/providers';
import * as TranscriptTranscribedPayload from './mocks/webhookRevAITranscriptTranscribed.json';
import * as TranscriptFailedPayload from './mocks/webhookRevAITranscriptFailed.json';

describe('WebhooksController', () => {
  let module: TestingModule;
  let controller: WebhooksController;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot()],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('revAI', () => {
    it('should handel transcript transcribed', async () => {
      await controller.revAI(TranscriptTranscribedPayload.job);
      const params: IEventOnTranscriptTranscribed = {
        transcriptionId: TranscriptTranscribedPayload.job.id,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onTranscriptTranscribed, params);
    });

    it('should handel transcript failed', async () => {
      await controller.revAI(TranscriptFailedPayload.job);
      const params: IEventOnTranscriptFailed = {
        transcriptionId: TranscriptFailedPayload.job.id,
        failureReason: TranscriptFailedPayload.job.failure_detail,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onTranscriptFailed, params);
    });
  });
});
