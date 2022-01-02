import { AuditType, QueueType } from '@lagunahealth/pandora';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigsService, OneSignal, SendBird, TwilioService } from '.';
import {
  EventType,
  IEventNotifyQueue,
  LoggerService,
  SendOneSignalNotification,
  SendSendBirdNotification,
} from '../common';
import { MemberConfig } from '../member';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configsService: ConfigsService,
    private readonly httpService: HttpService,
    private readonly twilio: TwilioService,
    readonly eventEmitter: EventEmitter2,
    private readonly sendBird: SendBird,
    private readonly oneSignal: OneSignal,
    private readonly logger: LoggerService,
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
    sendSendBirdNotification,
  }: {
    sendOneSignalNotification?: SendOneSignalNotification;
    sendSendBirdNotification?: SendSendBirdNotification;
  }): Promise<string | void> {
    if (sendOneSignalNotification) {
      this.logAudit(sendOneSignalNotification);
      return this.oneSignal.send(sendOneSignalNotification);
    }
    if (sendSendBirdNotification) {
      this.logAudit(sendSendBirdNotification);
      return this.sendBird.send(sendSendBirdNotification);
    }
  }

  async createPeerIceServers() {
    return this.twilio.createPeerIceServers();
  }

  //using send.name is intentionally
  private logAudit(payload) {
    const message = this.logger.formatAuditMessage(AuditType.message, payload, this.send.name);
    const eventParams: IEventNotifyQueue = { type: QueueType.audit, message };
    this.eventEmitter.emit(EventType.notifyQueue, eventParams);
  }
}
