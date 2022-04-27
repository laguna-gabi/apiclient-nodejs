import {
  BaseLogger,
  EventType,
  FailureReason,
  ServiceName,
  SlackChannel,
  SlackIcon,
} from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';

@Injectable()
export class LoggerService extends BaseLogger {
  // todo: do we need to log only certain properties under events? will there be any hipaa there?
  private static validKeys = new Set(['events']);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.clinicalEngine, LoggerService.validKeys);
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
