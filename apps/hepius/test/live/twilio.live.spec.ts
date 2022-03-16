import { mockLogger } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { LoggerService } from '../../src/common';
import { ConfigsService, TwilioService } from '../../src/providers';

describe('live: twilio', () => {
  let twilio: TwilioService;

  beforeAll(async () => {
    const configService = new ConfigsService();
    const logger = new LoggerService(PARAMS_PROVIDER_TOKEN as Params, new EventEmitter2());
    mockLogger(logger);

    twilio = new TwilioService(configService, logger);
    await twilio.onModuleInit();
  });

  describe('getPhoneType', () => {
    it('should return landline on a landline phone', async () => {
      const result = await twilio.getPhoneType('+18476757942');
      expect(result).toEqual('landline');
    });

    it('should return mobile on a mobile phone', async () => {
      const result = await twilio.getPhoneType('+16414250000');
      expect(result).toEqual('mobile');
    });

    it('should catch error internally on twilio incase number is not valid', async () => {
      const result = await twilio.getPhoneType('abc');
      expect(result).toBeUndefined();
    });
  });
});
