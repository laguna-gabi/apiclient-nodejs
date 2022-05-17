import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { raw } from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    raw({ type: '*/*' })(req, res, next);
  }
}
