import {
  BaseLogger,
  FailureReason,
  ServiceName,
  SlackChannel,
  SlackIcon,
  internalLogs,
} from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';
import { EventType } from './events';

@Injectable()
export class LoggerService extends BaseLogger {
  private static VALID_KEYS = new Set([
    // internal
    ...Object.keys(internalLogs),
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.iris, LoggerService.VALID_KEYS);
  }

  error(params = {}, className: string, methodName: string, failureReason?: FailureReason): void {
    const log = super.error(params, className, methodName, failureReason);

    this.eventEmitter.emit(EventType.notifySlack, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }
}
