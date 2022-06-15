import {
  GlobalEventType,
  IEventNotifySlack,
  SlackChannel,
  SlackIcon,
  mockLogger,
  mockProcessWarnings,
  webhooks,
} from '@argus/pandora';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DbModule } from '../../src/db';
import { dbConnect, dbDisconnect } from '..';
import {
  EventType,
  IEventOnTranscriptFailed,
  IEventOnTranscriptTranscribed,
  LoggerService,
  revai,
} from '../../src/common';
import { ConfigsService, ExternalConfigs, RevAI, WebhooksController } from '../../src/providers';
import * as TranscriptTranscribedPayload from './mocks/webhookRevAITranscriptTranscribed.json';
import * as TranscriptFailedPayload from './mocks/webhookRevAITranscriptFailed.json';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('WebhooksController', () => {
  let module: TestingModule;
  let controller: WebhooksController;
  let configsService: ConfigsService;
  let revAI: RevAI;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [DbModule, EventEmitterModule.forRoot()],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    configsService = module.get<ConfigsService>(ConfigsService);
    revAI = module.get<RevAI>(RevAI);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    mockLogger(module.get<LoggerService>(LoggerService));

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(async () => {
    spyOnEventEmitter.mockReset();
  });

  describe('revAI', () => {
    it('should handel transcript transcribed', async () => {
      await revAI.onModuleInit();
      const token = await configsService.getConfig(ExternalConfigs.revAI.webhookToken);
      await controller.transcriptComplete(TranscriptTranscribedPayload.job, token);
      const params: IEventOnTranscriptTranscribed = {
        transcriptionId: TranscriptTranscribedPayload.job.id,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onTranscriptTranscribed, params);
    });

    it('should handel transcript failed', async () => {
      await revAI.onModuleInit();
      const token = await configsService.getConfig(ExternalConfigs.revAI.webhookToken);
      await controller.transcriptComplete(TranscriptFailedPayload.job, token);
      const params: IEventOnTranscriptFailed = {
        transcriptionId: TranscriptFailedPayload.job.id,
        failureReason: TranscriptFailedPayload.job.failure_detail,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onTranscriptFailed, params);
    });

    it('should return FORBIDDEN for invalid token', async () => {
      await revAI.onModuleInit();

      await expect(
        controller.transcriptComplete(TranscriptTranscribedPayload.job, 'not-valid'),
      ).rejects.toThrow(new HttpException('Forbidden', HttpStatus.FORBIDDEN));

      const params: IEventNotifySlack = {
        header: `*RevAI webhook*`,
        message: `request from an unknown client was made to Post ${webhooks}/${revai}`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      expect(spyOnEventEmitter).toBeCalledWith(GlobalEventType.notifySlack, params);
    });
  });
});
