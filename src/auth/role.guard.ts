import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../src/common';

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
      const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
      if (isPublic) {
        return true;
      }
      return false;
    }

    if (user.roles.find((role) => allowedRoles.includes(role))) {
      return true;
    }

    return false;
  }
}
