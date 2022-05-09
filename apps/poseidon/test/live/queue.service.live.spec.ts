import { mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventType, LoggerService } from '../../src/common';
import { ConfigsService, QueueService } from '../../src/providers';
import * as s3NewRecordingEventMock from './mocks/s3NewRecordingEventMock.json';

describe('live: queue', () => {
  let queueService: QueueService;
  let configService: ConfigsService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;
  let logger: LoggerService;

  beforeAll(async () => {
    eventEmitter = new EventEmitter2();
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    configService = new ConfigsService();
    logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, eventEmitter);

    queueService = new QueueService(eventEmitter, configService, logger);

    mockProcessWarnings(); // to hide pino prettyPrint warning
  });

  it('should call event onCreateTranscript', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await queueService.handleMessage({ Body: JSON.stringify(s3NewRecordingEventMock) });

    expect(spyOnEventEmitter).toBeCalledWith(EventType.onCreateTranscript, {
      memberId: '619cdf3c384c1100278e2d34',
      recordingId: 'CAe66babd4ed74159353d4fc9587bf47f9',
    });
  });
});
