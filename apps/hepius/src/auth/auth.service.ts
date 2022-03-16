import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserSecurityService } from '.';
import { bearerToken } from '../common';

@Injectable()
export class AuthService {
  constructor(private userSecurityService: UserSecurityService) {}
  async validateUser(req: Request) {
    const authorizationHeader = req?.headers?.authorization?.replace(bearerToken, '');

    if (!authorizationHeader) {
      return {};
    }

    const decodedToken = jwt.decode(authorizationHeader);

    if (typeof decodedToken === 'object' && decodedToken?.sub) {
      const user = await this.userSecurityService.getUserByAuthId(decodedToken.sub);

      return user || (await this.userSecurityService.getMemberByAuthId(decodedToken.sub));
    }
  }
}
