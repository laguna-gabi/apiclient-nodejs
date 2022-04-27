import { Request, Response } from 'express';
import { json } from 'body-parser';
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    json()(req, res, next);
  }
}
