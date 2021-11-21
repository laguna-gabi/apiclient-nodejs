import { BaseLogger } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditType, EventType, IEventNotifyQueue, QueueType, SlackChannel, SlackIcon } from '.';

export const internalLogs = {
  hepiusVersion: 'Starting Hepius application version: @version@',
  lastCommit: 'Last commit hash on this branch is: @hash@',
  schedulerLeader:
    'Current instance is now leader of @type@ scheduler with identifier: @identifier@',
};

@Injectable()
export class Logger extends BaseLogger {
  private static VALID_KEYS = [
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
    //baseSchedulers
    'schedulerIdentifier',
    'lengthResults',
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
    ...Object.keys(internalLogs),
  ];

  constructor(private readonly eventEmitter: EventEmitter2) {
    super(Logger.VALID_KEYS);
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
