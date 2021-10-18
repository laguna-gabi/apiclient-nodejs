import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
@Injectable()
// Description: Authentication strategy - placeholder for real token validation.
//              since we are behind an API GW we will use a custom strategy to simply
//              set the user in request.
export class CustomStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(req: Request) {
    const user = await this.authService.validateUser(req);

    return user;
  }
}
