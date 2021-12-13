import { BaseLogger, ServiceName, SlackChannel, SlackIcon } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType } from './events';

@Injectable()
export class Logger extends BaseLogger {
  private static VALID_KEYS = [
    //queue
    'queueConsumerRunning',
    'MessageId',
    //all
    'type',
    //dispatch data
    'dispatchId',
    'correlationId',
    'serviceName',
    'notificationType',
    'recipientClientId',
    'senderClientId',
    'sendBirdChannelUrl',
    'appointmentId',
    'appointmentTime',
    'peerId',
    'contentKey',
    'chatLink',
    'triggeredAt',
    'triggeredId',
    'notificationId',
    'path',
    'status',
    'deliveredAt',
    'failureReasons',
    'retryCount',
    //settings data
    'id',
    'externalUserId',
  ];

  constructor(private readonly eventEmitter: EventEmitter2) {
    super(ServiceName.iris, Logger.VALID_KEYS);
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
}
