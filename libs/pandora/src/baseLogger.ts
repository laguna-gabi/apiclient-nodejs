import { Inject } from '@nestjs/common';
import { PARAMS_PROVIDER_TOKEN, Params, PinoLogger } from 'nestjs-pino';
import { v4 } from 'uuid';
import { AuditType, Environments, ServiceName } from '.';

export const internalLogs = {
  lastCommit: 'Last commit hash on this branch is: @hash@',
};

export class Client {
  id?: string;
  authId?: string;
  roles?: string[];
}

export class FailureReason {
  message?: string;
  code?: number;
  stack?: string;
  data?: string;
}

export enum LogType {
  log = 'log',
  info = 'info',
  warn = 'warn',
  error = 'error',
  debug = 'debug',
}

export class BaseLogger extends PinoLogger {
  private baseValidKeys = new Set([
    'id',
    'memberId',
    'userId',
    'orgId',
    'sub',
    'externalUserId',
    'lastCommit',
    //general finish method time
    'finishedAndItTook',
    // member recording
    'recordingId',
  ]);

  constructor(
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
    private source: ServiceName,
    private validKeys: Set<string> = new Set<string>(),
  ) {
    super(params);
    this.validKeys = new Set([...validKeys, ...this.baseValidKeys]);
  }

  log(params = {}, className: string, methodName: string): string | void {
    params = this.filterParams(params);
    super.info({ params, className, methodName });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.log);
  }

  info(params = {}, className: string, methodName: string, client?: Client): string | void {
    params = this.filterParams(params);
    super.info({ params, className, methodName, client });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.info);
  }

  debug(params = {}, className: string, methodName: string): string | void {
    params = this.filterParams(params);
    super.debug({ params, className, methodName });
    return this.logFormat(this.getCalledLog(params), className, methodName, LogType.debug);
  }

  error(
    params = {},
    className: string,
    methodName: string,
    failureReason?: FailureReason,
  ): string | void {
    params = this.filterParams(params);
    const { stack, ...failureParams } = failureReason || {};
    super.error({ params, className, methodName, failureReason: failureParams });
    console.error(stack); // console.log the stack separately so it doesn't blow up the log

    return this.logFormat(
      `${this.getCalledLog(params)} FAILED with result ${
        failureReason?.message || failureReason?.code
      }`,
      className,
      methodName,
      LogType.error,
    );
  }

  warn(
    params = {},
    className: string,
    methodName: string,
    failureReason?: FailureReason,
  ): string | void {
    params = this.filterParams(params);
    if (failureReason) delete failureReason.stack; // not logging the stack
    super.warn({ params, className, methodName, failureReason });
    return this.logFormat(
      `${this.getCalledLog(params)} WARN with result ${
        failureReason?.message || failureReason?.code
      }`,
      className,
      methodName,
      LogType.warn,
    );
  }

  formatAuditMessage(type: AuditType, params, methodName: string, authId?: string): string {
    const userPayload = authId ? `user: ${authId}, ` : '';
    return (
      `${userPayload}type: ${type}, date: ${new Date().toLocaleString()}, description: ` +
      `${this.source} ${methodName} ${this.getCalledLog(params)}`
    );
  }

  getCorrelationId(): string {
    return this.logger?.bindings?.().reqId || v4();
  }

  protected logFormat(
    text,
    className: string,
    methodName: string,
    logType: LogType,
    orgName?: string,
  ): string {
    const now = new Date();
    return `${now.toLocaleString()}    [${this.source}] [${logType}] ${this.generateOrgNamePrefix(
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
      return Object.fromEntries(Object.entries(params).filter(([key]) => this.validKeys.has(key)));
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

  private generateOrgNamePrefix = (orgName?: string): string => {
    return `${orgName ? ` [${orgName}] ` : ''}`;
  };
}

export const PinoHttpConfig = {
  genReqId: () => v4(), // correlation id
  autoLogging: false,
  quietReqLogger: true,
  level: LogType.debug,
  prettyPrint:
    !process.env.NODE_ENV ||
    process.env.NODE_ENV === Environments.test ||
    process.env.NODE_ENV === Environments.localhost
      ? {
          colorize: true,
          translateTime: 'SYS:dd/mm/yyyy, H:M:ss',
          singleLine: true,
          messageFormat: '[{className}] [{methodName}] {failureReason.message}',
          ignore: 'pid,hostname,className,methodName',
        }
      : false,
};
