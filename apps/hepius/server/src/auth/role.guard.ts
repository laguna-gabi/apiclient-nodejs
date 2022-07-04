import { UserRole } from '@argus/hepiusClient';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseGuard } from '.';
import { DecoratorType } from '../common';
import { intersection } from 'lodash';

@Injectable()
export class RolesGuard extends BaseGuard implements CanActivate {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  canActivate(context: ExecutionContext): boolean {
    // `rpc` type requests are managed via the TCP Auth. Interceptor
    if (context.getType() === 'rpc') {
      return true;
    }

    const request = this.getRequest(context);

    const user = request?.user as { roles: string[]; orgs: string[] };
    if (user?.roles?.includes(UserRole.lagunaAdmin)) {
      return true;
    }

    const allowedRoles = this.reflector.get<string[]>(DecoratorType.roles, context.getHandler());

    if (!allowedRoles?.length) {
      // if no roles associated to route we can accept an isPublic annotation
      return this.reflector.get<boolean>(DecoratorType.isPublic, context.getHandler());
    }

    return !!intersection(user.roles, allowedRoles)?.length;
  }
}
