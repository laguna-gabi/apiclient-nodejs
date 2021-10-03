import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from './log.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    let args;
    if (context.getType() === 'http') {
      const res = context.switchToHttp();
      args = res.getRequest().params;
    } else {
      args = context.getArgByIndex(1);
    }

    this.logger.debug(this.logger.getCalledLog(args), methodName, className);

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => this.logger.debug(`finished in ${Date.now() - now}ms`, methodName, className)),
      );
  }
}
