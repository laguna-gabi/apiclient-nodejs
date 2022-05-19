import { BaseLoggingInterceptor } from '@argus/pandora';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { LoggerService } from '.';

@Injectable()
export class LoggingInterceptor extends BaseLoggingInterceptor implements NestInterceptor {
  constructor(readonly logger: LoggerService, readonly eventEmitter: EventEmitter2) {
    super(logger, eventEmitter);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    return super.intercept(context, next);
  }
}
