import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { RoleTypes, SystemRoles, bearerToken } from '../common';
import { UserSecurityService } from '.';

@Injectable()
export class AuthService {
  constructor(private userSecurityService: UserSecurityService) {}
  async validateUser(req: Request) {
    const authorizationHeader = req?.headers?.authorization?.replace(bearerToken, '');

    if (!authorizationHeader) {
      return { role: RoleTypes.Anonymous };
    }

    const decodedToken = jwt.decode(authorizationHeader);

    if (typeof decodedToken === 'object' && decodedToken?.sub) {
      const user = await this.userSecurityService.getUserByAuthId(decodedToken.sub);

      if (user) {
        return {
          // TODO: utilize user roles for RBAC
          ...user,
          role: RoleTypes.User,
        };
      } else {
        const member = await this.userSecurityService.getMemberByAuthId(decodedToken.sub);
        if (member) {
          return {
            ...member,
            role: RoleTypes.Member,
          };
        }
      }
    }
    // if token is not valid or does not carry a sub claim we assume user is anonymous
    return { role: RoleTypes.Anonymous };
  }

  // Description: Given a user role and a set of (annotated) (allowed)roles on the endpoint
  //              determine if the user is allowed to access
  isAllowed(role: RoleTypes, allowedRoles: RoleTypes[]): boolean {
    if (SystemRoles[role].isAdmin) {
      return true;
    }

    // if we have an allowed role which has a lower weight we consider our role as allowed
    return allowedRoles.some((element) => {
      if (SystemRoles[element].weight <= SystemRoles[role].weight) return true;
      else return false;
    });
  }
}
