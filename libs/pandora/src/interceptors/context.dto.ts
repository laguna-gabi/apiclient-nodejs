import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

export abstract class RequestContext {
  static als = new AsyncLocalStorage<RequestContext>();

  static start = <T extends RequestContext>(constructor: new () => T): void => {
    RequestContext.als.enterWith(new constructor());
  };

  static get<T extends RequestContext>(): T {
    return RequestContext.als.getStore() as T;
  }
}

export class AppRequestContext extends RequestContext {
  client: string;
}

export function getRequestClientId(): string {
  return (RequestContext.get() as AppRequestContext)?.client;
}

export function requestContextMiddleware<T extends RequestContext>(
  contextClass: new () => T,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    RequestContext.start(contextClass);
    next();
  };
}
