import { AsyncLocalStorage } from 'async_hooks';

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
