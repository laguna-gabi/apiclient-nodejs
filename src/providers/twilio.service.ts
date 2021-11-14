import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';
import { Twilio, jwt } from 'twilio';
import { ConfigsService, ExternalConfigs } from '.';
import {
  Environments,
  EventType,
  IEventSlackMessage,
  Logger,
  SendTwilioNotification,
  SlackChannel,
  SlackIcon,
  generateOrgNamePrefix,
} from '../common';

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

  constructor(
    private readonly configsService: ConfigsService,
    private eventEmitter: EventEmitter2,
    private readonly logger: Logger,
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
    this.webhookToken = await this.configsService.getConfig(ExternalConfigs.twilio.webhookToken);
    this.client = new Twilio(this.accountSid, this.authToken);
  }

  async send(sendTwilioNotification: SendTwilioNotification) {
    this.logger.debug(sendTwilioNotification, TwilioService.name, this.send.name);
    const { body, to, orgName } = sendTwilioNotification;
    if (process.env.NODE_ENV === Environments.production && !to.startsWith('+972')) {
      try {
        //KEEP return await when its inside try catch
        return await this.client.messages.create({ body, to, from: this.source });
      } catch (ex) {
        this.logger.error(sendTwilioNotification, TwilioService.name, this.send.name, ex);
      }
    } else {
      const params: IEventSlackMessage = {
        message: `*SMS to ${to}${generateOrgNamePrefix(orgName)}*\n${body}`,
        icon: SlackIcon.phone,
        channel: SlackChannel.testingSms,
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

  validateWebhook(token: string) {
    return token === this.webhookToken;
  }
}
