import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger, Environments } from '.';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (process.env.NODE_ENV === Environments.test) {
      //disabling intercept log on tests, it causes a dump
      return next.handle().pipe(tap(() => undefined));
    }

    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    let args;
    if (context.getType() === 'http') {
      const res = context.switchToHttp();
      const { params, body } = res.getRequest();
      args = Object.keys(params).length > 0 ? { params } : {};
      args = Object.keys(body).length > 0 ? { ...args, body } : args;
    } else {
      args = context.getArgByIndex(1);
    }

    this.logger.debug(Object.values(args)[0], className, methodName);

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.debug({ finishedAndItTook: `${Date.now() - now}ms` }, className, methodName),
        ),
      );
  }
}
