import { Environments, IEventNotifySlack, SlackChannel, SlackIcon, formatEx } from '@argus/pandora';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { twilio } from 'config';
import { hoursToMilliseconds } from 'date-fns';
import { parsePhoneNumber } from 'libphonenumber-js';
import { Twilio as TwilioClient } from 'twilio';
import {
  ConfigsService,
  ExternalConfigs,
  Provider,
  ProviderResult,
  SendTwilioNotification,
  Slack,
} from '.';
import { ErrorType, Errors, LoggerService } from '../common';

@Injectable()
export class Twilio implements OnModuleInit {
  private client: TwilioClient;
  private readonly source;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly slack: Slack,
    private readonly logger: LoggerService,
  ) {
    this.source = twilio.source;
  }

  async onModuleInit(): Promise<void> {
    const accountSid = await this.configsService.getConfig(ExternalConfigs.twilio.accountSid);
    const authToken = await this.configsService.getConfig(ExternalConfigs.twilio.authToken);
    this.client = new TwilioClient(accountSid, authToken);
  }

  async send(
    sendTwilioNotification: SendTwilioNotification,
    correlationId: string,
  ): Promise<ProviderResult> {
    this.logger.info({ ...sendTwilioNotification, correlationId }, Twilio.name, this.send.name);
    const { body, to, orgName } = sendTwilioNotification;
    if (
      process.env.NODE_ENV === Environments.production &&
      !to.startsWith('+972') &&
      to !== twilio.get('iosExcludeRegistrationNumber')
    ) {
      try {
        if (
          parsePhoneNumber(to).isValid() &&
          twilio.get('validPhoneTypes').includes(parsePhoneNumber(to).getType())
        ) {
          //KEEP return await when its inside try catch
          const result = await this.createMessage(body, to, this.source);
          return { provider: Provider.twilio, content: result.body, id: result.sid };
        } else {
          throw new Error(Errors.get(ErrorType.invalidPhoneNumberForMessaging));
        }
      } catch (ex) {
        this.logger.error(
          { ...sendTwilioNotification, correlationId },
          Twilio.name,
          this.send.name,
          formatEx(ex),
        );
        throw ex;
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

  async createPeerIceServers(): Promise<{ iceServers }> {
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
