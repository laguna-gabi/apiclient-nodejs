import { InnerQueueTypes } from '@lagunahealth/pandora';
import { NotImplementedException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { internet, lorem } from 'faker';
import { Consumer, SQSMessage } from 'sqs-consumer';
import { v4 } from 'uuid';
import { CommonModule } from '../../src/common';
import { ConductorModule, ConductorService, QueueService } from '../../src/conductor';
import { DbModule } from '../../src/db';
import { ConfigsService, ProvidersModule } from '../../src/providers';
import { generateDispatch, generateId, generateUpdateUserSettingsMock } from '../generators';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');

describe(QueueService.name, () => {
  let module: TestingModule;
  let service: QueueService;
  let conductorService: ConductorService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DbModule,
        ProvidersModule,
        ConductorModule,
        CommonModule,
        EventEmitterModule.forRoot(),
      ],
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

  describe('isHealthy', () => {
    it('should report up on connected queues', () => {
      const result = service.isHealthy();
      expect(result).toEqual({
        notificationsQ: { status: 'up' },
        notificationsDLQ: { status: 'up' },
      });
    });

    it('should report down on not connected queues', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.notificationsQ = undefined;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      service.notificationsDLQ = undefined;
      const result = service.isHealthy();
      expect(result).toEqual({
        notificationsQ: { status: 'down' },
        notificationsDLQ: { status: 'down' },
      });
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
        ...generateUpdateUserSettingsMock(),
        type: InnerQueueTypes.updateClientSettings,
      };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnUpdateClientSettings = jest.spyOn(conductorService, 'handleUpdateClientSettings');
      spyOnUpdateClientSettings.mockResolvedValue(null);

      await service.handleMessage(message);

      expect(spyOnUpdateClientSettings).toBeCalledWith(params);
      spyOnUpdateClientSettings.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.deleteClientSettings}`, async () => {
      const params = { id: generateId(), type: InnerQueueTypes.deleteClientSettings };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnDeleteClientSettings = jest.spyOn(conductorService, 'handleDeleteClientSettings');
      spyOnDeleteClientSettings.mockResolvedValue(null);

      await service.handleMessage(message);

      expect(spyOnDeleteClientSettings).toBeCalledWith(params);
      spyOnDeleteClientSettings.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.createDispatch}`, async () => {
      const params = { ...generateDispatch(), type: InnerQueueTypes.createDispatch };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnCrateDispatch = jest.spyOn(conductorService, 'handleCreateDispatch');
      spyOnCrateDispatch.mockResolvedValue(null);

      await service.handleMessage(message);

      delete params.deliveredAt;
      delete params.triggeredAt;
      expect(spyOnCrateDispatch).toBeCalledWith(expect.objectContaining(params));
      spyOnCrateDispatch.mockReset();
    });

    it(`should handle message of type ${InnerQueueTypes.deleteDispatch}`, async () => {
      const params = { dispatchId: generateId(), type: InnerQueueTypes.deleteDispatch };
      const message: SQSMessage = { MessageId: v4(), Body: JSON.stringify(params) };
      const spyOnDeleteDispatch = jest.spyOn(conductorService, 'handleDeleteDispatch');
      spyOnDeleteDispatch.mockResolvedValue(null);

      await service.handleMessage(message);

      expect(spyOnDeleteDispatch).toBeCalledWith(params);
      spyOnDeleteDispatch.mockReset();
    });
  });
});
