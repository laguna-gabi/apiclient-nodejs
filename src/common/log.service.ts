import { Inject, Injectable } from '@nestjs/common';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditType, EventType, IEventNotifyQueue, QueueType } from '.';
import { BaseLogger, ServiceName, SlackChannel, SlackIcon } from '@lagunahealth/pandora';

export const internalLogs = {
  hepiusVersion: 'Starting Hepius application version: @version@',
  lastCommit: 'Last commit hash on this branch is: @hash@',
};

@Injectable()
export class LoggerService extends BaseLogger {
  private static VALID_KEYS = new Set([
    'id',
    'memberId',
    'userId',
    'orgId',
    'appointmentId',
    'start',
    'end',
    'notBefore',
    'type',
    'availabilities',
    'externalUserId',
    'sendBirdChannelUrl',
    'senderUserId',
    'deviceId',
    'sub',
    //sendbird create user params
    'channel_url',
    'cover_url',
    'inviter_id',
    'user_ids',
    'user_id',
    //general finish method time
    'finishedAndItTook',
    //slackbot
    'channel',
    //replace user
    'newUserId',
    'oldUserId',
    //sendbird webhook
    'sender',
    //memeber journal
    'normalImageKey',
    'smallImageKey',
    //queue
    'MessageId',
    //dispatches
    'dispatchId',
    'correlationId',
    'serviceName',
    'notificationType',
    'recipientClientId',
    'senderClientId',
    'appointmentTime',
    'appointmentId',
    'contentKey',
    'triggersAt',
    'path',
    ...Object.keys(internalLogs),
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.hepius, LoggerService.VALID_KEYS);
  }

  warn(params: any = {}, className: string, methodName: string, ...reasons: any[]): void {
    const log = super.warn(params, className, methodName, ...reasons);

    this.eventEmitter.emit(EventType.notifySlack, {
      message: log,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    });
  }

  error(params: any = {}, className: string, methodName: string, ...reasons: any[]): void {
    const log = super.error(params, className, methodName, ...reasons);

    this.eventEmitter.emit(EventType.notifySlack, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }

  audit(type: AuditType, params, methodName: string, authId?: string): void {
    const eventParams: IEventNotifyQueue = {
      type: QueueType.audit,
      message:
        `user: ${authId}, type: ${type}, date: ${new Date().toLocaleString()}, description: ` +
        `Hepius ${methodName} ${super.getCalledLog(params)}`,
    };
    this.eventEmitter.emit(EventType.notifyQueue, eventParams);
  }
}
