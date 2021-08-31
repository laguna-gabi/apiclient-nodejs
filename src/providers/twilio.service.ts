import { Injectable, NotImplementedException, OnModuleInit } from '@nestjs/common';
import { ConfigsService, ExternalConfigs } from '.';
import { Twilio, jwt } from 'twilio';
import * as config from 'config';
import { INotifications } from './interfaces';
import { Platform, SendNotificationParams } from '../common';

@Injectable()
export class TwilioService implements OnModuleInit, INotifications {
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

  async register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<string | undefined> {
    throw new NotImplementedException();
  }

  send(sendNotificationParams: SendNotificationParams): Promise<boolean> {
    throw new NotImplementedException();
  }

  async sendSms({ body, to, from = this.source }: { body: string; to: string; from: string }) {
    await this.client.messages.create({ body, to, from });
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

  async unregister(playerId: string, platform: Platform): Promise<void> {
    throw new NotImplementedException();
  }
}
