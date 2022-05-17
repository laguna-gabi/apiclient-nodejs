import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '.';

export function requestContextMiddleware<T extends RequestContext>(
  contextClass: new () => T,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    RequestContext.start(contextClass);
    next();
  };
}
