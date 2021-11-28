import { InnerQueueTypes } from '@lagunahealth/pandora';
import { NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { internet, lorem } from 'faker';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { CommonModule } from '../../src/common';
import { ConductorModule, ConductorService, QueueService } from '../../src/conductor';
import { DbModule } from '../../src/db';
import { ConfigsService, ProvidersModule } from '../../src/providers';
import { generateClientSettings, generateDispatch, generateId } from '../generators';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;
  let conductorService: ConductorService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DbModule, ProvidersModule, ConductorModule, CommonModule],
    }).compile();
    service = module.get<QueueService>(QueueService);

    conductorService = module.get<ConductorService>(ConductorService);

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
      const params = {
        ...generateClientSettings(),
        type: InnerQueueTypes.updateClientSettings,
      };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnHandleUpdateClientSettings = jest.spyOn(
        conductorService,
        'handleUpdateClientSettings',
      );
      spyOnHandleUpdateClientSettings.mockResolvedValue(null);

      await service.handleMessage(message);

      expect(spyOnHandleUpdateClientSettings).toBeCalledWith(params);
      spyOnHandleUpdateClientSettings.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.createDispatch}`, async () => {
      const params = { ...generateDispatch(), type: InnerQueueTypes.createDispatch };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnHandleCrateDispatch = jest.spyOn(conductorService, 'handleCreateDispatch');
      spyOnHandleCrateDispatch.mockResolvedValue(null);

      await service.handleMessage(message);

      delete params.deliveredAt;
      delete params.triggeredAt;
      expect(spyOnHandleCrateDispatch).toBeCalledWith(expect.objectContaining(params));
      spyOnHandleCrateDispatch.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.deleteDispatch}`, async () => {
      const params = { dispatchId: generateId(), type: InnerQueueTypes.deleteDispatch };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnHandleDeleteDispatch = jest.spyOn(conductorService, 'handleDeleteDispatch');
      spyOnHandleDeleteDispatch.mockResolvedValue(null);

      await service.handleMessage(message);

      expect(spyOnHandleDeleteDispatch).toBeCalledWith(params);
      spyOnHandleDeleteDispatch.mockReset();
    });
  });
});
