import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { apiPrefix, EventType, SlackChannel, SlackIcon, webhooks } from '../../src/common';
import { TwilioService, WebhooksController } from '../../src/providers';
import { dbDisconnect, defaultModules } from '../index';
import * as sendBirdNewMessagePayload from './mocks/webhookSendbirdNewMessagePayload.json';
import * as sendBirdAdminMessagePayload from './mocks/webhookSendbirdAdminMessagePayload.json';
import * as twilioPayload from './mocks/webhookTwilioPayload.json';

describe('WebhooksController', () => {
  let module: TestingModule;
  let controller: WebhooksController;
  let eventEmitter: EventEmitter2;
  let twilioService: TwilioService;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    controller = module.get<WebhooksController>(WebhooksController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    twilioService = module.get<TwilioService>(TwilioService);
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

    it('should generate an event with a normal new message payload', async () => {
      await controller.sendbird(sendBirdNewMessagePayload);

      expect(spyOnEventEmitter).toBeCalledWith(EventType.notifyChatMessage, {
        senderUserId: sendBirdNewMessagePayload.sender.user_id,
        sendBirdChannelUrl: sendBirdNewMessagePayload.channel.channel_url,
      });
    });

    it('should NOT generate an event with an admin message payload', async () => {
      await controller.sendbird(sendBirdAdminMessagePayload);
      expect(spyOnEventEmitter).not.toHaveBeenCalled();

    });

    describe('twilio', () => {
      afterEach(() => {
        spyOnEventEmitter.mockReset();
      });

      it('should call send SMS event on valid request', async () => {
        await twilioService.onModuleInit();
        await controller.incomingSms(twilioPayload.body, twilioPayload.signature);

        expect(spyOnEventEmitter).toBeCalledWith(EventType.sendSmsToChat, {
          phone: twilioPayload.body.From,
          message: twilioPayload.body.Body,
        });
      });

      it('should call slackMessage event on invalid request', async () => {
        await twilioService.onModuleInit();
        await controller.incomingSms({ not: 'valid' }, 'not-valid');

        expect(spyOnEventEmitter).toBeCalledWith(EventType.slackMessage, {
          // eslint-disable-next-line max-len
          message: `*TWILIO WEBHOOK*\nrequest from an unknown client was made to Post ${apiPrefix}/${webhooks}/twilio/incoming-sms`,
          icon: SlackIcon.warning,
          channel: SlackChannel.notifications,
        });
      });
    });
  });
});
