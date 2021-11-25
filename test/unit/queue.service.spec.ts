import { InnerQueueTypes } from '@lagunahealth/pandora';
import { NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { internet, lorem } from 'faker';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { ConfigsService, ProvidersModule, QueueService } from '../../src/providers';
import {
  generateCreateDispatchParams,
  generateDeleteDispatchParams,
  generateUpdateClientSettingsParams,
} from '../generators';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [ProvidersModule] }).compile();
    service = module.get<QueueService>(QueueService);

    const configsService = module.get<ConfigsService>(ConfigsService);
    jest.spyOn(configsService, 'getConfig').mockResolvedValue(lorem.word());
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

    Consumer.create = jest.fn().mockImplementation(() => ({ on: jest.fn(), start: jest.fn() }));

    it('should init queues', async () => {
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.notificationsQ).toEqual(queueUrl);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.notificationsDLQ).toEqual(queueUrl);
    });
  });

  describe('handleMessage', () => {
    it('should throw error on invalid message type', async () => {
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify({ field: 4, type: lorem.word() }),
      };

      await expect(service.handleMessage(message)).rejects.toThrow(NotImplementedException);
    });

    it(`should handle message of type ${InnerQueueTypes.updateClientSettings}`, async () => {
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify(generateUpdateClientSettingsParams()),
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const spyOnHandleUpdateClientSettings = jest.spyOn(service, 'handleUpdateClientSettings');

      await service.handleMessage(message);

      expect(spyOnHandleUpdateClientSettings).toBeCalledWith(JSON.parse(message.Body));
      spyOnHandleUpdateClientSettings.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.createDispatch}`, async () => {
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify(generateCreateDispatchParams()),
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const spyOnHandleCreateDispatch = jest.spyOn(service, 'handleCreateDispatch');

      await service.handleMessage(message);

      expect(spyOnHandleCreateDispatch).toBeCalledWith(JSON.parse(message.Body));
      spyOnHandleCreateDispatch.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.deleteDispatch}`, async () => {
      const message: SQSMessage = {
        MessageId: v4(),
        Body: JSON.stringify(generateDeleteDispatchParams()),
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const spyOnHandleDeleteDispatch = jest.spyOn(service, 'handleDeleteDispatch');

      await service.handleMessage(message);

      expect(spyOnHandleDeleteDispatch).toBeCalledWith(JSON.parse(message.Body));
      spyOnHandleDeleteDispatch.mockReset();
    });
  });
});
