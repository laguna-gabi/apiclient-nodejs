import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppRequestContext, RequestContext } from '.';

@Injectable()
export class TcpAuthInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<void> {
    if (context.getType() === 'rpc') {
      const args = context.switchToRpc().getData();
      if (!args.clientId) {
        throw new UnauthorizedException();
      }

      let ctx: AppRequestContext = RequestContext.get();
      if (!ctx) {
        RequestContext.start(AppRequestContext);
        ctx = RequestContext.get();
      }

      ctx.client = args.clientId;
    }

    return next.handle();
  }
}
