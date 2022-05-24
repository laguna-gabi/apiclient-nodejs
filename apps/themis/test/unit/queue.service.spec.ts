import { Test, TestingModule } from '@nestjs/testing';
import { ConfigsService, ProvidersModule, QueueService } from '../../src/providers';
import { Environments, generateId, mockLogger, mockProcessWarnings } from '@argus/pandora';
import { CommonModule, LoggerService } from '../../src/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { internet, lorem } from 'faker';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { NotAcceptableException } from '@nestjs/common';
import { v4 } from 'uuid';
import { EventType } from '../../src/common/events';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter: jest.SpyInstance;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: [ProvidersModule, CommonModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<QueueService>(QueueService);
    mockLogger(module.get<LoggerService>(LoggerService));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emitAsync');
  });

  afterAll(async () => {
    await module.close();
  });

  describe('onModuleInit', () => {
    const queueUrl = internet.url();
    AWS.SQS = jest.fn().mockImplementation(() => ({
      getQueueUrl: jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({ QueueUrl: queueUrl }),
      }),
    }));

    Consumer.create = jest
      .fn()
      .mockImplementation(() => ({ on: jest.fn(), start: jest.fn(), stop: jest.fn() }));

    describe('onModuleInit', () => {
      beforeEach(() => {
        process.env.NODE_ENV = Environments.test;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        service.changeEventQueueUrl = undefined;
      });

      it('should init change event queue', async () => {
        await service.onModuleInit();

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(service.changeEventQueueUrl).toEqual(queueUrl);
      });
    });
  });

  describe('handleMessage', () => {
    afterEach(() => {
      spyOnEventEmitter.mockReset();
    });

    it('should throw error on invalid message', async () => {
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({ memberId: generateId() + 'invalid' }),
      };

      await expect(service.handleMessage(message)).rejects.toThrow(NotAcceptableException);
    });

    it('should emit a valid change event', async () => {
      const memberId = generateId();
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({ memberId }),
      };

      await service.handleMessage(message);

      expect(spyOnEventEmitter).toHaveBeenCalledWith(EventType.onChangeEvent, {
        memberId,
      });
    });
  });
});
