import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { EventType } from '../../src/common';
import {
  ConfigsService,
  ExternalConfigs,
  TwilioService,
  WebhooksController,
} from '../../src/providers';
import { dbDisconnect, defaultModules } from '../index';
import * as sendBirdAdminMessagePayload from './mocks/webhookSendbirdAdminMessagePayload.json';
import * as sendBirdNewMessagePayload from './mocks/webhookSendbirdNewMessagePayload.json';

describe('WebhooksController', () => {
  let module: TestingModule;
  let controller: WebhooksController;
  let eventEmitter: EventEmitter2;
  let twilioService: TwilioService;
  let configsService: ConfigsService;
  let spyOnEventEmitter;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    controller = module.get<WebhooksController>(WebhooksController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    twilioService = module.get<TwilioService>(TwilioService);
    configsService = module.get<ConfigsService>(ConfigsService);
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
        const token = await configsService.getConfig(ExternalConfigs.twilio.webhookToken);
        await controller.incomingSms({
          Body: 'test',
          From: '+972525945870',
          Token: token,
        });

        expect(spyOnEventEmitter).toBeCalledWith(EventType.sendSmsToChat, {
          message: 'test',
          phone: '+972525945870',
        });
      });

      it('should call slackMessage event on invalid request', async () => {
        await twilioService.onModuleInit();

        await expect(controller.incomingSms({ not: 'valid' })).rejects.toThrow(
          new HttpException('Forbidden', HttpStatus.FORBIDDEN),
        );
      });
    });
  });
});
