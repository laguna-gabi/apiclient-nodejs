import { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

export class GlobalAuthGuard extends AuthGuard('custom') {
  getRequest(context: ExecutionContext): any {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);

      return ctx.getContext().req ? ctx.getContext().req : {};
    }

    return context.switchToHttp().getRequest();
  }
}
