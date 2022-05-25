import { Environments, formatEx } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { twilio } from 'config';
import { Twilio, jwt } from 'twilio';
import { ConfigsService, ExternalConfigs } from '.';
import { LoggerService, PhoneType } from '../common';

@Injectable()
export class TwilioService implements OnModuleInit {
  private accountSid;
  private appSid;
  private authToken;
  private apiKey;
  private apiSecret;
  private webhookToken;
  private client;
  private readonly source;
  private readonly identity;

  constructor(private readonly configsService: ConfigsService, private logger: LoggerService) {
    this.source = twilio.get('source');
    this.identity = twilio.get('identity');
  }

  async onModuleInit() {
    this.accountSid = await this.configsService.getConfig(ExternalConfigs.twilio.accountSid);
    this.appSid = await this.configsService.getConfig(ExternalConfigs.twilio.appSid);
    this.authToken = await this.configsService.getConfig(ExternalConfigs.twilio.authToken);
    this.apiKey = await this.configsService.getConfig(ExternalConfigs.twilio.apiKey);
    this.apiSecret = await this.configsService.getConfig(ExternalConfigs.twilio.apiSecret);
    this.webhookToken = await this.configsService.getConfig(ExternalConfigs.twilio.webhookToken);
    this.client = new Twilio(this.accountSid, this.authToken);
  }

  getAccessToken() {
    const voiceGrant = new jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: this.appSid,
      incomingAllow: true,
    });

    const token = new jwt.AccessToken(this.accountSid, this.apiKey, this.apiSecret, {
      identity: this.identity,
    });

    token.addGrant(voiceGrant);
    return token.toJwt();
  }

  validateWebhook(token: string) {
    return token === this.webhookToken;
  }

  async getPhoneType(phone: string): Promise<PhoneType> {
    try {
      if (process.env.NODE_ENV === Environments.production) {
        const { carrier } = await this.client.lookups
          .phoneNumbers(phone)
          .fetch({ type: ['carrier'] });
        return carrier.type;
      } else {
        return 'mobile';
      }
    } catch (ex) {
      this.logger.error({}, TwilioService.name, this.getPhoneType.name, formatEx(ex));
    }
    return undefined;
  }
}
