import {
  BaseLogger,
  FailureReason,
  ServiceName,
  SlackChannel,
  SlackIcon,
} from '@lagunahealth/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventType } from './events';

@Injectable()
export class Logger extends BaseLogger {
  private static VALID_KEYS = new Set([
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
    'triggersAt',
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
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.iris, Logger.VALID_KEYS);
  }

  error(
    params: any = {},
    className: string,
    methodName: string,
    failureReason?: FailureReason,
  ): void {
    const log = super.error(params, className, methodName, failureReason);

    this.eventEmitter.emit(EventType.notifySlack, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }
}
