import { SetMetadata } from '@nestjs/common';
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

export const Public = () => SetMetadata('isPublic', true);

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

export const Client = createParamDecorator((data: string, context: ExecutionContext) => {
  let request;

  if (context.getType<GqlContextType>() === 'graphql') {
    const ctx = GqlExecutionContext.create(context);
    request = ctx.getContext().req;
  } else {
    request = context.switchToHttp().getRequest();
  }
  const user = request.user;
  return data ? user?.[data] : user;
});
