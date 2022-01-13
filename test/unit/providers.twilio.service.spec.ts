import {
  Environments,
  SlackChannel,
  SlackIcon,
  mockLogger,
  mockProcessWarnings,
} from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { twilio } from 'config';
import { lorem } from 'faker';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { ErrorType, Errors, LoggerService } from '../../src/common';
import { Slack, Twilio } from '../../src/providers';

describe('Twilio', () => {
  let module: TestingModule;
  let twilioService: Twilio;
  let logger: LoggerService;
  let slack: Slack;

  let spyOnInternalSend;
  let spyOnError;
  let spyOnSlack;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    logger = module.get<LoggerService>(LoggerService);
    mockLogger(logger);
    twilioService = module.get<Twilio>(Twilio);
    slack = module.get<Slack>(Slack);

    spyOnError = jest.spyOn(logger, 'error');
    spyOnInternalSend = jest.spyOn(twilioService as any, 'createMessage');
    spyOnSlack = jest.spyOn(slack, 'send');
  });

  afterAll(async () => {
    await module.close();
    spyOnError.mockReset();
    spyOnInternalSend.mockReset();
    spyOnSlack.mockReset();
  });

  describe('send', () => {
    beforeEach(() => {
      spyOnInternalSend.mockReturnValueOnce({ body: lorem.word(), sid: v4() });
      spyOnSlack.mockReturnValueOnce({ text: lorem.word() });
    });

    afterEach(() => {
      process.env.NODE_ENV = Environments.test; // make sure to restore environment to `test`
      spyOnInternalSend.mockReset();
      spyOnSlack.mockReset();
    });

    test.each([
      [
        'invalid (Apple user) phone in production env - should not call twilio send - use slack',
        twilio.get('iosExcludeRegistrationNumber'),
        false, // message sent via Twilio
        true, // message sent via Slack
        Environments.production,
      ],
      [
        'valid IL phone in production env - should send message via slack',
        '+972501234567',
        false, // message sent via Twilio
        true, // message sent via Slack
        Environments.production,
      ],
      [
        'valid phone in non-production env - should not call twilio send - instead, send via slack',
        '+12133734253',
        false, // message sent via Twilio
        true, // message sent via Slack
        Environments.test,
      ],
      [
        'valid phone in production env - should not call twilio send - instead, send via slack',
        '+12133734253',
        true, // message sent via Twilio
        false, // message sent via Slack
        Environments.production,
      ],
    ])('%p', async (_, to, messageSentToTwilio, messageSentViaSlack, env) => {
      process.env.NODE_ENV = env;
      const body = lorem.sentence();
      await twilioService.send({ body, to }, v4());

      if (messageSentToTwilio) {
        expect(spyOnInternalSend).toBeCalledWith(body, to, twilio.get('source'));
      } else {
        expect(spyOnInternalSend).not.toBeCalled();
      }

      if (messageSentViaSlack) {
        expect(spyOnSlack).toBeCalledWith({
          header: `*SMS to ${to}*`,
          message: body,
          channel: SlackChannel.testingSms,
          icon: SlackIcon.phone,
        });
      } else {
        expect(spyOnSlack).not.toBeCalled();
      }

      expect(spyOnError).not.toBeCalled();
    });

    it('invalid phone in production env - should throw an error message', async () => {
      process.env.NODE_ENV = Environments.production;
      const body = lorem.sentence();
      await expect(twilioService.send({ body, to: '+1234567' }, v4())).rejects.toThrow(
        Error(Errors.get(ErrorType.invalidPhoneNumberForMessaging)),
      );
    });
  });
});
