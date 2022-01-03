import { SlackChannel, SlackIcon, mockLogger } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { twilio } from 'config';
import { lorem } from 'faker';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { Environments, ErrorType, Errors, Logger } from '../../src/common';
import { Slack, Twilio } from '../../src/providers';

describe('Twilio', () => {
  let module: TestingModule;
  let twilioService: Twilio;
  let logger: Logger;
  let slack: Slack;

  let spyOnInternalSend;
  let spyOnLogger;
  let spyOnSlack;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    logger = module.get<Logger>(Logger);
    mockLogger(logger);
    twilioService = module.get<Twilio>(Twilio);
    slack = module.get<Slack>(Slack);

    spyOnLogger = jest.spyOn(logger, 'error');
    spyOnInternalSend = jest.spyOn(twilioService as any, 'createMessage');
    spyOnSlack = jest.spyOn(slack, 'send');
  });

  afterAll(async () => {
    await module.close();
    spyOnLogger.mockReset();
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
        false, // error message issued
        Environments.production,
      ],
      [
        'valid IL phone in production env - should send message via slack',
        '+972501234567',
        false, // message sent via Twilio
        true, // message sent via Slack
        false, // error message issued
        Environments.production,
      ],
      [
        'valid phone in non-production env - should not call twilio send - instead, send via slack',
        '+12133734253',
        false, // message sent via Twilio
        true, // message sent via Slack
        false, // error message issued
        Environments.test,
      ],
      [
        'valid phone in production env - should not call twilio send - instead, send via slack',
        '+12133734253',
        true, // message sent via Twilio
        false, // message sent via Slack
        false, // error message issued
        Environments.production,
      ],
      [
        'invalid phone in production env - should log error message',
        '+1234567',
        undefined, // message sent via Twilio (twilio is invoked with error)
        false, // message sent via Slack
        true, // error message issued
        Environments.production,
      ],
    ])('%p', (_, to, messageSentToTwilio, messageSentViaSlack, logError, env) => {
      process.env.NODE_ENV = env;
      const body = lorem.sentence();
      twilioService.send({ body, to });

      if (messageSentToTwilio) {
        expect(spyOnInternalSend).toBeCalledWith(body, to, twilio.get('source'));
      } else {
        expect(spyOnInternalSend).not.toBeCalled();
      }

      if (messageSentViaSlack && !logError) {
        expect(spyOnSlack).toBeCalledWith({
          header: `*SMS to ${to}*`,
          message: body,
          channel: SlackChannel.testingSms,
          icon: SlackIcon.phone,
        });
      } else if (!logError) {
        expect(spyOnSlack).not.toBeCalled();
      }

      if (logError) {
        expect(spyOnLogger).toBeCalledWith(
          { body, to },
          Twilio.name,
          'send',
          expect.objectContaining({
            message: Errors.get(ErrorType.invalidPhoneNumberForMessaging),
          }),
        );
      } else {
        expect(spyOnLogger).not.toBeCalled();
      }
    });
  });
});
