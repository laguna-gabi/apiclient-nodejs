import { Test, TestingModule } from '@nestjs/testing';
import { dbDisconnect, defaultModules } from '../index';
import { WebhooksController } from '../../src/providers';
import * as sendbirdUserPayload from './mocks/webhookSendbirdPayloadMessageFromUser.json';
import * as sendbirdMemberPayload from './mocks/webhookSendbirdPayloadMessageFromMember.json';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType } from '../../src/common';

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

    it('should generate an event with a payload sent by a user', async () => {
      await controller.sendbird(sendbirdUserPayload);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyChatMessage, {
        senderUserId: sendbirdUserPayload.sender.user_id,
        receiverUserId: sendbirdUserPayload.members[0].user_id,
      });
    });

    it('should generate an event with a payload sent by a member', async () => {
      await controller.sendbird(sendbirdMemberPayload);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyChatMessage, {
        senderUserId: sendbirdMemberPayload.sender.user_id,
        receiverUserId: sendbirdMemberPayload.members[1].user_id,
      });
    });
  });
});
