import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as config from 'config';
import { Twilio, jwt } from 'twilio';
import { ConfigsService, ExternalConfigs } from '.';
import {
  Environments,
  ErrorType,
  Errors,
  EventType,
  LoggerService,
  SendTwilioNotification,
  generateOrgNamePrefix,
} from '../common';
import { IEventNotifySlack, SlackChannel, SlackIcon } from '@lagunahealth/pandora';
import { hoursToMilliseconds } from 'date-fns';
import { twilio } from 'config';
import { parsePhoneNumber } from 'libphonenumber-js';

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
    private readonly logger: LoggerService,
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
    if (
      process.env.NODE_ENV === Environments.production &&
      !to.startsWith('+972') &&
      to !== config.get('iosExcludeRegistrationNumber')
    ) {
      try {
        if (
          parsePhoneNumber(to).isValid() &&
          config.get('twilio.validPhoneTypes').includes(parsePhoneNumber(to).getType())
        ) {
          //KEEP return await when its inside try catch
          return await this.createMessage(body, to, this.source);
        } else {
          throw new Error(Errors.get(ErrorType.invalidPhoneNumberForMessaging));
        }
      } catch (ex) {
        this.logger.error(sendTwilioNotification, TwilioService.name, this.send.name, ex);
      }
    } else {
      const params: IEventNotifySlack = {
        message: `*SMS to ${to}${generateOrgNamePrefix(orgName)}*\n${body}`,
        icon: SlackIcon.phone,
        channel: SlackChannel.testingSms,
      };
      this.eventEmitter.emit(EventType.notifySlack, params);
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

  async createPeerIceServers(): Promise<{ iceServers: any[] }> {
    const { iceServers } = await this.client.tokens.create({
      ttl: hoursToMilliseconds(twilio.traversalServiceTokenTtl),
    });

    return { iceServers };
  }

  // Description: internal service create message method
  private async createMessage(body: string, to: string, from: string) {
    return this.client.messages.create({ body, to, from });
  }
}
