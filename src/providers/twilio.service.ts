import { Injectable, OnModuleInit } from '@nestjs/common';
import { twilio } from 'config';
import { hoursToMilliseconds } from 'date-fns';
import { Twilio, jwt } from 'twilio';
import { ConfigsService, ExternalConfigs } from '.';

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

  constructor(private readonly configsService: ConfigsService) {
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

  async createPeerIceServers(): Promise<{ iceServers: any[] }> {
    const { iceServers } = await this.client.tokens.create({
      ttl: hoursToMilliseconds(twilio.traversalServiceTokenTtl),
    });

    return { iceServers };
  }
}
