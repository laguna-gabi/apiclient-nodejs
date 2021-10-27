import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { bearerToken } from '../common';
import { UserSecurityService } from './auth.security.service';
import { Roles } from './roles';

@Injectable()
export class AuthService {
  constructor(private userSecurityService: UserSecurityService) {}
  async validateUser(req: Request) {
    const authorizationHeader = req?.headers?.authorization?.replace(bearerToken, '');

    if (!authorizationHeader) {
      return { role: Roles.Anonymous };
    }

    const decodedToken = jwt.decode(authorizationHeader);

    if (typeof decodedToken === 'object' && decodedToken?.sub) {
      const user = await this.userSecurityService.getUserByAuthId(decodedToken.sub);

      if (user) {
        return {
          // TODO: utilize user roles for RBAC
          ...user.toObject(),
          role: Roles.User,
        };
      } else {
        const member = await this.userSecurityService.getMemberByAuthId(decodedToken.sub);
        if (member) {
          return {
            ...member.toObject(),
            role: Roles.Member,
          };
        }
      }
    }
    // if token is not valid or does not carry a sub claim we assume user is anonymous
    return { role: Roles.Anonymous };
  }
}
