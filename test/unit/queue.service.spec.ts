import { Environments } from '@lagunahealth/pandora';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import * as faker from 'faker';
import { internet, lorem } from 'faker';
import { Logger, QueueType } from '../../src/common';
import { ConfigsService, ProvidersModule, QueueService } from '../../src/providers';
import { mockLogger } from '../index';
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

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ProvidersModule, EventEmitterModule.forRoot()],
    }).compile();

    service = module.get<QueueService>(QueueService);
    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());
    mockLogger(module.get<Logger>(Logger));
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
    });

    it('should init notification queue on non production environment', async () => {
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.notificationsQueueUrl).toEqual(queueUrl);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.auditQueueUrl).toEqual(undefined);
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
      expect(sendMessage).toBeCalledWith({ MessageBody: param.message, QueueUrl: queueUrl });
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
});
