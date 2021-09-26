import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigsService, environments, ExternalConfigs } from '.';
import { Twilio, jwt } from 'twilio';
import * as config from 'config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType, IEventSlackMessage, slackChannel, SlackIcon } from '../common';

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

  constructor(
    private readonly configsService: ConfigsService,
    private eventEmitter: EventEmitter2,
  ) {
    this.source = config.get('twilio.source');
    this.identity = config.get('twilio.identity');
  }

  async onModuleInit() {
    this.accountSid = await this.configsService.getConfig(ExternalConfigs.twilio.accountSid);
    this.appSid = await this.configsService.getConfig(ExternalConfigs.twilio.appSid);
    this.authToken = await this.configsService.getConfig(ExternalConfigs.twilio.authToken);
    this.apiKey = await this.configsService.getConfig(ExternalConfigs.twilio.apiKey);
    this.apiSecret = await this.configsService.getConfig(ExternalConfigs.twilio.apiSecret);
    this.client = new Twilio(this.accountSid, this.authToken);
  }

  async send({ body, to }: { body: string; to: string }) {
    if (process.env.NODE_ENV === environments.production && !to.startsWith('+972')) {
      /**
       * KEEP return await when its inside try catch
       */
      try {
        return await this.client.messages.create({ body, to, from: this.source });
      } catch (ex) {
        console.error(ex);
      }
    } else {
      const params: IEventSlackMessage = {
        message: `*SMS to ${to}*\n${body}`,
        icon: SlackIcon.phone,
        channel: slackChannel.testingSms,
      };
      this.eventEmitter.emit(EventType.slackMessage, params);
    }
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
