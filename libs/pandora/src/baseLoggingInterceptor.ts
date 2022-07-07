import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditType, BaseLogger, Client, GlobalEventType, QueueType } from '.';

export class BaseLoggingInterceptor implements NestInterceptor {
  constructor(
    protected readonly logger: BaseLogger,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    const methodName = context.getHandler().name;
    const className = context.getClass().name;
    let args;
    let type;
    let request;

    if (context.getType() === 'http') {
      request = context.switchToHttp().getRequest();
      const { params, body } = request;
      args = Object.keys(params).length > 0 ? { params } : {};
      args = Object.keys(body).length > 0 ? { ...args, body } : args;
      type = request.method === 'GET' ? AuditType.read : AuditType.write;
    } else if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext().req;
      args = context.getArgByIndex(1);
      type = this.getGqlType(context);
    } else if (context.getType() === 'rpc') {
      args = context.switchToRpc().getData();
      type = AuditType.command;
    }

    const params = BaseLoggingInterceptor.getParams(args);
    const client: Client = BaseLoggingInterceptor.getClient(request?.user);
    this.logger.info(params, className, methodName, client);

    const message = this.logger.formatAuditMessage(type, params, methodName, client?.authId);
    const eventParams = { type: QueueType.audit, message };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventParams);

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.info({ finishedAndItTook: `${Date.now() - now}ms` }, className, methodName),
        ),
      );
  }

  /**
   * There are 2 ways to get params from gql:
   * 1. Special Param object we defined (like CreateUserParams)
   * 2. Just one independent param (like memberId)
   * When there's just one param, the args would look like {"memberId": <id>} so we need to log the whole 'args' object.
   * When there's a special object, the args would look like {"createUserParams": <params>},
   * and we want to take only the value (the params)
   */
  private static getParams(args) {
    const params = Object.values(args)[0];
    return typeof params === 'string' || Array.isArray(params) ? args : params;
  }

  private static getClient(client) {
    return {
      id: client?._id?.toString(),
      roles: client?.roles,
      authId: client?.authId,
    };
  }

  getGqlType(context: ExecutionContext): AuditType {
    let type: AuditType;
    if (GqlExecutionContext.create(context).getInfo().fieldName === 'deleteMember') {
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
