import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Environments, ErrorType, Errors, Logger } from '../../src/common';
import { defaultModules } from '../common';
import { TwilioService } from '../../src/providers';
import * as config from 'config';
import * as faker from 'faker';

describe('Twilio', () => {
  let module: TestingModule;
  let twilioService: TwilioService;
  let eventEmitter: EventEmitter2;
  let logger: Logger;

  let spyOnEventEmitter;
  let spyOnInternalSend;
  let spyOnLogger;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: defaultModules() }).compile();
    twilioService = module.get<TwilioService>(TwilioService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    logger = module.get<Logger>(Logger);

    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');
    spyOnInternalSend = jest.spyOn(twilioService as any, 'createMessage');

    spyOnLogger = jest.spyOn(logger, 'error');
  });

  afterAll(async () => {
    await module.close();
  });

  describe('send', () => {
    afterEach(() => {
      process.env.NODE_ENV = Environments.test; // make sure to restore environment to `test`
      spyOnEventEmitter.mockReset();
      spyOnInternalSend.mockReset();
    });

    test.each([
      [
        'invalid (Apple user) phone in production env - should not call twilio send',
        config.get('iosExcludeRegistrationNumber'),
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
        'valid phone in non-production env - should not call twilio send',
        '+12133734253',
        false, // message sent via Twilio
        true, // message sent via Slack
        false, // error message issued
        Environments.test,
      ],
      [
        'valid phone in production env - should not call twilio send',
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
      const body = faker.lorem.sentence();
      twilioService.send({ body, to });

      if (messageSentToTwilio) {
        expect(spyOnInternalSend).toBeCalledWith(body, to, config.get('twilio.source'));
      } else {
        expect(spyOnInternalSend).not.toBeCalled();
      }

      if (messageSentViaSlack && !logError) {
        expect(spyOnEventEmitter).toBeCalledWith('notifySlack', {
          channel: 'slack.testingSms',
          icon: ':telephone_receiver:',
          message: `*SMS to ${to}*\n${body}`,
        });
      } else if (!logError) {
        expect(spyOnEventEmitter).not.toBeCalled();
      }

      if (logError) {
        expect(spyOnLogger).toBeCalledWith(
          { body, to },
          'TwilioService',
          'send',
          new Error(Errors.get(ErrorType.invalidPhoneNumberForMessaging)),
        );
      } else {
        expect(spyOnLogger).not.toBeCalled();
      }
    });
  });
});
