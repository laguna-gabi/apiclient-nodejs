import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '.';
import { AppRequestContext, RequestContext } from '@argus/pandora';

// Description: Authentication strategy - placeholder for real token validation.
//              since we are behind an API GW we will use a custom strategy to simply
//              set the user in request.

@Injectable()
export class CustomStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(req: Request) {
    const client: { _id?: string } = await this.authService.validateUser(req);

    // load client to context (async local storage)
    const ctx: AppRequestContext = RequestContext.get();
    if (ctx) {
      ctx.client = client?._id;
    }

    return client;
  }
}
