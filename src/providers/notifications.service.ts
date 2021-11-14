import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigsService, OneSignal } from '.';
import {
  AuditType,
  CancelNotificationParams,
  Logger,
  SendOneSignalNotification,
  SendSendBirdNotification,
  SendTwilioNotification,
} from '../common';
import { MemberConfig } from '../member';
import { SendBird, TwilioService } from '.';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  private readonly oneSignal: OneSignal;

  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
    readonly eventEmitter: EventEmitter2,
    private readonly sendBird: SendBird,
    private readonly logger: Logger,
  ) {
    this.oneSignal = new OneSignal(configsService, httpService, eventEmitter, logger);
  }

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
  }): Promise<string> {
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
}
