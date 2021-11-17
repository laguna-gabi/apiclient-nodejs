import { Environments, generateOrgNamePrefix } from '.';

enum LogType {
  log = 'log',
  warn = 'warn',
  error = 'error',
  debug = 'debug',
}

export class BaseLogger {
  constructor(private validKeys: string[]) {}

  protected COLOR = {
    reset: '\x1b[0m',

    fgBlack: '\x1b[30m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    fgBlue: '\x1b[34m',
    fgMagenta: '\x1b[35m',
    fgCyan: '\x1b[36m',
    fgWhite: '\x1b[37m',
  };

  log(params: any = {}, className: string, methodName: string): string | void {
    const log = this.logFormat(
      this.getCalledLog(params),
      className,
      methodName,
      LogType.log,
      this.COLOR.fgWhite,
    );
    console.info(log);

    return log;
  }

  warn(params: any = {}, className: string, methodName: string, ...reasons: any[]): string | void {
    const log = this.logFormat(
      `${this.getCalledLog(params)} WARN with result ${reasons}`,
      className,
      methodName,
      LogType.warn,
      this.COLOR.fgYellow,
      params?.orgName,
    );
    console.warn(log);

    return log;
  }

  error(params: any = {}, className: string, methodName: string, ...reasons: any[]): string | void {
    const log = this.logFormat(
      `${this.getCalledLog(params)} FAILED with result ${reasons}`,
      className,
      methodName,
      LogType.error,
      this.COLOR.fgRed,
      params?.orgName,
    );
    console.error(log);

    return log;
  }

  debug(params: any = {}, className: string, methodName: string): string | void {
    const log = this.logFormat(
      this.getCalledLog(params),
      className,
      methodName,
      LogType.debug,
      this.COLOR.fgWhite,
    );
    console.debug(log);

    return log;
  }

  /**
   * @params is the input of params to the method.
   * @params can be:
   * 1. object of key value pairs : params = {memberId: '123abc', type: 'call'}
   *    we'll keep only the hipaa compliance fields. for example-'firstName' will not be logged.
   * 2. a string value representing an id: params = '123abc'
   *    we'll log this id.
   */
  protected getCalledLog(params): string {
    if (!params || Object.keys(params).length === 0) {
      return 'was called';
    }

    if (params.finishedAndItTook) {
      return `finished in ${params.finishedAndItTook}`;
    }

    const dupParams = { ...params };
    let safeLog = {};
    if (!dupParams) {
      safeLog = {};
    } else if (typeof dupParams === 'string') {
      safeLog = dupParams;
    } else {
      this.validKeys.forEach((validKey) => {
        if (dupParams[validKey]) {
          safeLog[validKey] = dupParams[validKey];
        }
      });
    }

    return `was called with params ${JSON.stringify(safeLog)}`;
  }

  protected logFormat(
    text: string,
    className: string,
    methodName: string,
    logType: LogType,
    color,
    orgName?: string,
  ): string {
    const now = new Date();
    const date = this.generateText(now.toLocaleString(), this.COLOR.fgWhite);
    const mName = this.generateText(methodName, this.COLOR.fgMagenta);
    const cName = this.generateText(`[${className}]`, this.COLOR.fgYellow);
    const lType = this.generateText(`[${logType}]`.padEnd(11), this.COLOR.fgWhite);
    const textFormatted = this.generateText(text, color);

    if (this.isColorLog()) {
      return `${date}   ${lType} ${cName} ${mName} ${textFormatted}`;
    } else {
      `${now.toLocaleString()}   [${logType}] [${className}]${generateOrgNamePrefix(
        orgName,
      )}${methodName} ${text}`;
    }
  }

  protected isColorLog(): boolean {
    return !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test;
  }

  private generateText(text: string, color): string {
    return `${color}${text}${this.COLOR.reset}`;
  }
}
