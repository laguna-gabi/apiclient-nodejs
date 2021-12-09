import { BaseLogger, SourceApi } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';

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
    'sourceApi',
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

  constructor() {
    super(SourceApi.iris, Logger.VALID_KEYS);
  }
}
