import { IEventNotifySlack, SlackChannel, SlackIcon } from '@lagunahealth/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as config from 'config';
import { hoursToMilliseconds } from 'date-fns';
import { Twilio as TwilioClient } from 'twilio';
import {
  ConfigsService,
  ExternalConfigs,
  Provider,
  ProviderResult,
  SendTwilioNotification,
  Slack,
} from '.';
import { Environments, Logger } from '../common';
import { twilio } from 'config';

@Injectable()
export class Twilio implements OnModuleInit {
  private client;
  private readonly source;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly slack: Slack,
    private readonly logger: Logger,
  ) {
    this.source = config.get('twilio.source');
  }

  async onModuleInit(): Promise<void> {
    const accountSid = await this.configsService.getConfig(ExternalConfigs.twilio.accountSid);
    const authToken = await this.configsService.getConfig(ExternalConfigs.twilio.authToken);
    this.client = new TwilioClient(accountSid, authToken);
  }

  async send(sendTwilioNotification: SendTwilioNotification): Promise<ProviderResult> {
    this.logger.info(sendTwilioNotification, Twilio.name, this.send.name);
    const { body, to, orgName } = sendTwilioNotification;
    if (process.env.NODE_ENV === Environments.production && !to.startsWith('+972')) {
      try {
        //KEEP return await when its inside try catch
        const result = await this.client.messages.create({ body, to, from: this.source });
        return { provider: Provider.twilio, content: result.body, id: result.sid };
      } catch (ex) {
        this.logger.error(sendTwilioNotification, Twilio.name, this.send.name, ex);
      }
    } else {
      const params: IEventNotifySlack = {
        header: `*SMS to ${to}*`,
        message: body,
        icon: SlackIcon.phone,
        channel: SlackChannel.testingSms,
        orgName,
      };
      const result = await this.slack.send(params);
      return { provider: Provider.slack, content: params.message, id: result.text };
    }
  }

  async createPeerIceServers(): Promise<{ iceServers: any[] }> {
    const { iceServers } = await this.client.tokens.create({
      ttl: hoursToMilliseconds(twilio.traversalServiceTokenTtl),
    });

    return { iceServers };
  }
}
