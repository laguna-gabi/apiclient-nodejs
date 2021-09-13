import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { Twilio, jwt } from 'twilio';
import * as config from 'config';

@Injectable()
export class TwilioService implements OnModuleInit {
  private accountSid;
  private appSid;
  private authToken;
  private apiKey;
  private apiSecret;
  private client;
  private source;
  private identity;

  constructor(private readonly configsService: ConfigsService) {
    this.source = config.get('twilio.source');
    this.identity = config.get('twilio.identity');
  }

  async onModuleInit() {
    this.accountSid = await this.configsService.getConfig(ExternalConfigs.twilioAccountSid);
    this.appSid = await this.configsService.getConfig(ExternalConfigs.twilioAppSid);
    this.authToken = await this.configsService.getConfig(ExternalConfigs.twilioAuthToken);
    this.apiKey = await this.configsService.getConfig(ExternalConfigs.twilioApiKey);
    this.apiSecret = await this.configsService.getConfig(ExternalConfigs.twilioApiSecret);
    this.client = new Twilio(this.accountSid, this.authToken);
  }

  async send({ body, to }: { body: string; to: string }) {
    return this.client.messages.create({ body, to, from: this.source });
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
}
