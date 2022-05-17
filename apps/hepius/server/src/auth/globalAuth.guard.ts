import { ExecutionContext } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

export class GlobalAuthGuard extends AuthGuard('custom') {
  getRequest(context: ExecutionContext): HttpArgumentsHost {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);

      return ctx.getContext().req ? ctx.getContext().req : {};
    }

    return context.switchToHttp().getRequest();
  }
}
