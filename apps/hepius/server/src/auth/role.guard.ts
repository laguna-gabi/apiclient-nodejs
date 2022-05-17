import { UserRole } from '@argus/hepiusClient';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    let request;

    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext().req;
    } else {
      request = context.switchToHttp().getRequest();
    }

    const user = request?.user as { roles: string[] };
    if (user?.roles?.find((role) => role == UserRole.admin)) {
      return true;
    }

    const allowedRoles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!allowedRoles?.length) {
      // if no roles associated to route we can accept an isPublic annotation
      return this.reflector.get<boolean>('isPublic', context.getHandler());
    }

    if (user.roles.find((role) => allowedRoles.includes(role))) {
      return true;
    }

    return false;
  }
}
