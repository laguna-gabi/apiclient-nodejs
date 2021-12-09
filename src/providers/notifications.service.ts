import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigsService, OneSignal, SendBird, TwilioService } from '.';
import {
  AuditType,
  CancelNotificationParams,
  Logger,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { MemberConfig } from '../member';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
    readonly eventEmitter: EventEmitter2,
    private readonly sendBird: SendBird,
    private readonly oneSignal: OneSignal,
    private readonly logger: Logger,
  ) {}

  async register({
    token,
    externalUserId,
  }: {
    token: string;
    externalUserId: string;
  }): Promise<string | undefined> {
    return this.oneSignal.register({ token, externalUserId });
  }

  async unregister(memberConfig: MemberConfig) {
    return this.oneSignal.unregister(memberConfig);
  }

  async send({
    sendOneSignalNotification,
    sendTwilioNotification,
    sendSendBirdNotification,
  }: {
    sendOneSignalNotification?: SendOneSignalNotification;
    sendTwilioNotification?: SendTwilioNotification;
    sendSendBirdNotification?: SendSendBirdNotification;
  }): Promise<string | void> {
    if (sendOneSignalNotification) {
      this.logger.audit(AuditType.message, sendOneSignalNotification, this.send.name);
      return this.oneSignal.send(sendOneSignalNotification);
    }
    if (sendTwilioNotification) {
      this.logger.audit(AuditType.message, sendTwilioNotification, this.send.name);
      return this.twilio.send(sendTwilioNotification);
    }
    if (sendSendBirdNotification) {
      this.logger.audit(AuditType.message, sendSendBirdNotification, this.send.name);
      return this.sendBird.send(sendSendBirdNotification);
    }
  }

  async cancel(cancelNotificationParams: CancelNotificationParams) {
    this.logger.audit(AuditType.message, cancelNotificationParams, this.cancel.name);
    return this.oneSignal.cancel(cancelNotificationParams);
  }

  async createPeerIceServers() {
    return this.twilio.createPeerIceServers();
  }
}
