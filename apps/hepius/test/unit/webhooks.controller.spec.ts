import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { EventType, IEventOnReceivedChatMessage, LoggerService } from '../../src/common';
import {
  ConfigsService,
  ExternalConfigs,
  SendBird,
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
  let sendbirdService: SendBird;
  let configsService: ConfigsService;
  let spyOnEventEmitter;
  let spyOnTokenValidation;
  let spyOnSendbirdServiceGetMasterAppToken;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    twilioService = module.get<TwilioService>(TwilioService);
    sendbirdService = module.get<SendBird>(SendBird);
    configsService = module.get<ConfigsService>(ConfigsService);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    spyOnTokenValidation = jest.spyOn(controller, 'validateMessageSentFromSendbird');
    spyOnSendbirdServiceGetMasterAppToken = jest.spyOn(sendbirdService, 'getMasterAppToken');
    mockLogger(module.get<LoggerService>(LoggerService));
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('sendbird', () => {
    beforeAll(() => {
      spyOnTokenValidation.mockImplementation();
    });

    afterEach(() => {
      spyOnEventEmitter.mockReset();
    });

    it('should generate an event with a normal new message payload', async () => {
      await controller.sendbird(JSON.stringify(sendBirdNewMessagePayload), {});
      const eventParams: IEventOnReceivedChatMessage = {
        senderUserId: sendBirdNewMessagePayload.sender.user_id,
        sendBirdChannelUrl: sendBirdNewMessagePayload.channel.channel_url,
      };
      expect(spyOnEventEmitter).toBeCalledWith(EventType.onReceivedChatMessage, eventParams);
    });

    it('should NOT generate an event with an admin message payload', async () => {
      await controller.sendbird(JSON.stringify(sendBirdAdminMessagePayload), {});
      expect(spyOnEventEmitter).not.toHaveBeenCalled();
    });

    it('should NOT throw an exception due to invalid sendbird signature', async () => {
      spyOnTokenValidation.mockRestore();
      spyOnSendbirdServiceGetMasterAppToken.mockReturnValue('test');

      expect(() => {
        controller.sendbird(JSON.stringify(sendBirdAdminMessagePayload), {
          'x-sendbird-signature':
            '0fd23b3336df400d9537bee51a273da12c31150d30d80873e788d519d016343b',
        });
      }).not.toThrow();
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

        expect(spyOnEventEmitter).toBeCalledWith(EventType.onReceivedTextMessage, {
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
