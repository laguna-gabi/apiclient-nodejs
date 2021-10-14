import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { EventType } from '../../src/common';
import { WebhooksController } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../index';
import * as sendbirdUserPayload from './mocks/webhookSendbirdPayload.json';

describe('WebhooksController', () => {
  let module: TestingModule;
  let controller: WebhooksController;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    controller = module.get<WebhooksController>(WebhooksController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('sendbird', () => {
    afterEach(() => {
      spyOnEventEmitter.mockReset();
    });

    it('should generate an event with a payload', async () => {
      await controller.sendbird(sendbirdUserPayload);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyChatMessage, {
        senderUserId: sendbirdUserPayload.sender.user_id,
        sendbirdChannelUrl: sendbirdUserPayload.channel.channel_url,
      });
    });
  });
});
