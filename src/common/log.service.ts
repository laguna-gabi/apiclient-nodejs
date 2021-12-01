import { BaseLogger } from '@lagunahealth/pandora';
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
    'senderClient',
    'sendBirdChannelUrl',
    'appointmentId',
    'peerId',
    'triggeredAt',
    'notificationId',
    'path',
    //settings data
    'id',
    'externalUserId',
  ];

  constructor() {
    super(Logger.VALID_KEYS);
  }
}
