import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { AuthService } from '.';
import { RoleTypes, SystemRoles } from '../common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    let request;

    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext().req;
    } else {
      request = context.switchToHttp().getRequest();
    }
    const user = request?.user as { role: string };
    if (SystemRoles[user?.role as RoleTypes]?.isAdmin) {
      return true;
    }

    const roles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!roles?.length) {
      // if no roles associated to route we can accept an isPublic annotation
      const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
      if (isPublic) {
        return true;
      }
      return false;
    }

    if (this.authService.isAllowed(user.role as RoleTypes, roles as RoleTypes[])) {
      return true;
    }
    return false;
  }
}
