import { Environments, QueueType, ServiceName, mockLogger } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { internet, lorem } from 'faker';
import { Consumer } from 'sqs-consumer';
import { LoggerService } from '../../src/common';
import { ConfigsService, ProvidersModule, QueueService, StorageService } from '../../src/providers';
import { newImageEvent } from './mocks/sqsS3EventNewImage';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');

const queueUrl = internet.url();
const sendMessage = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue(undefined),
});
AWS.SQS = jest.fn().mockImplementation(() => ({
  sendMessage,
  getQueueUrl: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({ QueueUrl: queueUrl }),
  }),
}));
Consumer.create = jest.fn().mockImplementation(() => ({ on: jest.fn(), start: jest.fn() }));

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;
  let storageService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<QueueService>(QueueService);
    const configsService = module.get<ConfigsService>(ConfigsService);
    storageService = module.get<StorageService>(StorageService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
  });

  describe('onModuleInit', () => {
    beforeEach(() => {
      process.env.NODE_ENV = Environments.test;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.notificationsQueueUrl = undefined;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.auditQueueUrl = undefined;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.imageQueueUrl = undefined;
    });

    it('should init notification queue on non production environment', async () => {
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.notificationsQueueUrl).toEqual(queueUrl);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.auditQueueUrl).toEqual(undefined);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.imageQueueUrl).toEqual(queueUrl);
    });

    it('should init audit queue on production environment', async () => {
      process.env.NODE_ENV = Environments.production;
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.notificationsQueueUrl).toEqual(queueUrl);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.auditQueueUrl).toEqual(queueUrl);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.imageQueueUrl).toEqual(queueUrl);
    });
  });

  describe('sendMessage', () => {
    beforeAll(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.notificationsQueueUrl = queueUrl;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.auditQueueUrl = queueUrl;
    });

    it('should send to a message to notification queue', async () => {
      const param = { type: QueueType.notifications, message: faker.lorem.sentence() };
      await service.sendMessage(param);

      expect(sendMessage).toBeCalledTimes(1);
      expect(sendMessage).toBeCalledWith({ MessageBody: param.message, QueueUrl: queueUrl });

      sendMessage.mockClear();
    });

    it('should send to a message to audit queue on production environment', async () => {
      process.env.NODE_ENV = Environments.production;
      const param = { type: QueueType.audit, message: faker.lorem.sentence() };
      await service.sendMessage(param);

      expect(sendMessage).toBeCalledTimes(1);
      expect(sendMessage).toBeCalledWith({
        MessageBody: param.message,
        MessageDeduplicationId: expect.any(String),
        MessageGroupId: ServiceName.hepius,
        QueueUrl: queueUrl,
      });
      process.env.NODE_ENV = Environments.test;

      sendMessage.mockClear();
    });

    it('should not send a message to audit queue on non production environment', async () => {
      const param = { type: QueueType.audit, message: faker.lorem.sentence() };
      await service.sendMessage(param);

      expect(sendMessage).not.toBeCalled();
      sendMessage.mockClear();
    });
  });

  describe('handleMessage', () => {
    let spyOnStorageServicecreateJournalImageThumbnail;

    beforeEach(() => {
      spyOnStorageServicecreateJournalImageThumbnail = jest.spyOn(
        storageService,
        'createJournalImageThumbnail',
      );
    });

    afterEach(() => {
      spyOnStorageServicecreateJournalImageThumbnail.mockReset();
    });

    it('should create smallImageKey and call createJournalImageThumbnail', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await service.handleMessage(newImageEvent);

      expect(spyOnStorageServicecreateJournalImageThumbnail).toBeCalledTimes(1);
      expect(spyOnStorageServicecreateJournalImageThumbnail).toBeCalledWith(
        'public/journals/61b844fedac80a096e6e7f7b/61b845cd04f05609bd4d5ed9_NormalImage.jpeg',
        'public/journals/61b844fedac80a096e6e7f7b/61b845cd04f05609bd4d5ed9_SmallImage.jpeg',
      );
    });
  });
});
