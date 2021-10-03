import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class Logger implements LoggerService {
  constructor(private readonly className?: string) {}

  private VALID_KEYS = [
    'id',
    'memberId',
    'userId',
    'orgId',
    'appointmentId',
    'start',
    'end',
    'notBefore',
    'type',
    'availabilities',
    'externalUserId',
    'sendbirdChannelUrl',
  ];

  log(message: any, methodName: string, ...optionalParams: any[]) {
    console.info(this.logFormat(message, COLOR.fgWhite, methodName), optionalParams);
  }

  error(message: any, methodName: string, ...optionalParams: any[]) {
    console.error(this.logFormat(message, COLOR.fgRed, methodName), optionalParams);
  }

  warn(message: any, methodName: string, ...optionalParams: any[]) {
    console.warn(this.logFormat(message, COLOR.fgYellow, methodName), optionalParams);
  }

  debug(message: any, methodName: string, className?: string) {
    console.debug(this.logFormat(message, COLOR.fgWhite, methodName, className));
  }

  logFormat(text: string, color, methodName: string, className?: string) {
    const now = new Date();
    const cName = className ? className : this.className;
    const mName = `${COLOR.fgMagenta}${methodName}${COLOR.reset}`;
    return `${COLOR.fgBlue}${now.toLocaleString()}     ${
      COLOR.fgYellow
    }[${cName}] ${mName} ${color}${text}${COLOR.reset}`;
  }

  /**
   * @params is the input of params to the method.
   * @params can be:
   * 1. object of key value pairs : params = {memberId: '123abc', type: 'call'}
   *    we'll keep only the hipaa compliance fields. for example-'firstName' will not be logged.
   * 2. a string value representing an id: params = '123abc'
   *    we'll log this id.
   */
  getCalledLog(params) {
    if (Object.keys(params).length === 0) {
      return params;
    }

    const dupParams = Object.values(params)[0];
    let safeLog = {};
    if (!dupParams) {
      safeLog = {};
    } else if (typeof dupParams === 'string') {
      safeLog = dupParams;
    } else {
      this.VALID_KEYS.forEach((validKey) => {
        if (dupParams[validKey]) {
          safeLog[validKey] = dupParams[validKey];
        }
      });
    }

    return `was called with params ${JSON.stringify(safeLog)}`;
  }
}

const COLOR = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};
