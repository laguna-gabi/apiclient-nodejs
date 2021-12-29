import { PARAMS_PROVIDER_TOKEN, Params, PinoLogger } from 'nestjs-pino';
import { Client, LogType, ServiceName, generateOrgNamePrefix } from '.';
import { Inject } from '@nestjs/common';

export class BaseLogger extends PinoLogger {
  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private source: ServiceName,
    private validKeys: Set<string> = new Set<string>(),
  ) {
    super(params);
  }

  log(params: any = {}, className: string, methodName: string): string | void {
    params = this.filterParams(params);
    super.info({ params, className, methodName });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.log);
  }

  info(params: any = {}, className: string, methodName: string, client?: Client): string | void {
    params = this.filterParams(params);
    super.info({ params, className, methodName, client });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.info);
  }

  debug(params: any = {}, className: string, methodName: string): string | void {
    params = this.filterParams(params);
    super.debug({ params, className, methodName });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.debug);
  }

  error(params: any = {}, className: string, methodName: string, ...reasons: any[]): string | void {
    params = this.filterParams(params);

    super.error({ params, className, methodName, reasons });
    return this.logFormat(
      `${this.getCalledLog(params)} FAILED with result ${reasons}`,
      className,
      methodName,
      LogType.error,
    );
  }

  warn(params: any = {}, className: string, methodName: string, ...reasons: any[]): string | void {
    params = this.filterParams(params);
    super.warn({ params, className, methodName, reasons });
    return this.logFormat(
      `${this.getCalledLog(params)} WARN with result ${reasons}`,
      className,
      methodName,
      LogType.warn,
    );
  }

  protected logFormat(
    text,
    className: string,
    methodName: string,
    logType: LogType,
    orgName?: string,
  ): string {
    const now = new Date();
    return `${now.toLocaleString()}    [${this.source}] [${logType}] ${generateOrgNamePrefix(
      orgName,
    )} [${className}] ${methodName} ${text}`;
  }

  /**
   * @params is the input of params to the method.
   * @params can be:
   * 1. object of key value pairs : params = {memberId: '123abc', type: 'call'}
   *    we'll keep only the hipaa compliance fields. for example-'firstName' will not be logged.
   * 2. a string value representing an id: params = '123abc'
   *    we'll log this id.
   */
  protected filterParams(params) {
    if (typeof params === 'string') {
      return params;
    } else {
      return Object.fromEntries(
        Object.entries(params).filter(([key, value]) => this.validKeys.has(key) && value !== null),
      );
    }
  }

  protected getCalledLog(params): string {
    if (!params || Object.keys(params).length === 0) {
      return 'was called';
    }
    if (params.finishedAndItTook) {
      return `finished in ${params.finishedAndItTook}`;
    }
    return `was called with params ${JSON.stringify(params)}`;
  }
}
