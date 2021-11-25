import { BaseLogger } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';

@Injectable()
export class Logger extends BaseLogger {
  private static VALID_KEYS = ['queueConsumerRunning', 'MessageId'];

  constructor() {
    super(Logger.VALID_KEYS);
  }
}
