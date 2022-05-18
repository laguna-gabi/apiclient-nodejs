import {
  BaseLogger,
  FailureReason,
  GlobalEventType,
  ServiceName,
  SlackChannel,
  SlackIcon,
} from '@argus/pandora';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PARAMS_PROVIDER_TOKEN, Params } from 'nestjs-pino';

@Injectable()
export class LoggerService extends BaseLogger {
  private static validKeys = new Set([
    'transcriptionId',
    'status',
    'conversationPercentage',
    'coach',
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(params, ServiceName.poseidon, LoggerService.validKeys);
  }

  error(params = {}, className: string, methodName: string, failureReason?: FailureReason): void {
    const log = super.error(params, className, methodName, failureReason);

    this.eventEmitter.emit(GlobalEventType.notifySlack, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }
}
