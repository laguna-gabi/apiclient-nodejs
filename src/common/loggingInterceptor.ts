import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditType, Environments, Logger, extractAuthorizationHeader } from '.';
import { GqlExecutionContext } from '@nestjs/graphql';

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
    let headers;
    let type;

    if (context.getType() === 'http') {
      const res = context.switchToHttp();
      headers = extractAuthorizationHeader(context);
      const { params, body } = res.getRequest();
      args = Object.keys(params).length > 0 ? { params } : {};
      args = Object.keys(body).length > 0 ? { ...args, body } : args;
      type = res.getRequest().method === 'GET' ? AuditType.read : AuditType.write;
    } else {
      args = context.getArgByIndex(1);
      headers = extractAuthorizationHeader(GqlExecutionContext.create(context).getContext());
      type = this.getGqlType(context);
    }

    this.logger.debug(
      Object.values(args)[0] || { deviceId: headers?.username },
      className,
      methodName,
    );
    this.logger.audit(type, Object.values(args)[0], methodName, headers?.sub);

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.debug({ finishedAndItTook: `${Date.now() - now}ms` }, className, methodName),
        ),
      );
  }

  getGqlType(context: ExecutionContext): AuditType {
    let type: AuditType;
    if (GqlExecutionContext.create(context).getInfo().fieldName === 'archiveMember') {
      type = AuditType.archive;
    } else if (GqlExecutionContext.create(context).getInfo().fieldName === 'deleteMember') {
      type = AuditType.delete;
    } else if (GqlExecutionContext.create(context).getInfo().fieldName === 'replaceUserForMember') {
      type = AuditType.userReplaced;
    } else {
      GqlExecutionContext.create(context).getInfo().operation.operation === 'mutation'
        ? (type = AuditType.write)
        : (type = AuditType.read);
    }
    return type;
  }
}
