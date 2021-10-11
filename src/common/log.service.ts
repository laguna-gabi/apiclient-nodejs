import { Injectable } from '@nestjs/common';
import { EventType } from './events';
import { SlackChannel, SlackIcon } from './interfaces.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Errors, Environments } from '.';

@Injectable()
export class Logger {
  constructor(private readonly eventEmitter: EventEmitter2) {}

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

  log(message: any, className: string, methodName: string) {
    const { colorLog, log } = this.logFormat(message, className, methodName, COLOR.fgWhite);
    console.info(this.isColorLog() ? colorLog : log);
  }

  error(message: any, className: string, methodName: string) {
    for (const value of Errors.values()) {
      if (value === message) {
        const { colorLog, log } = this.logFormat(className, 'Exception', '', COLOR.fgRed);
        console.error(this.isColorLog() ? colorLog : log);
        return;
      }
    }

    const { colorLog, log } = this.logFormat(message, className, methodName, COLOR.fgRed);
    console.error(this.isColorLog() ? colorLog : log);

    this.eventEmitter.emit(EventType.slackMessage, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }

  warn(message: any, className: string, methodName: string) {
    const { colorLog, log } = this.logFormat(message, className, methodName, COLOR.fgYellow);
    console.warn(this.isColorLog() ? colorLog : log);

    this.eventEmitter.emit(EventType.slackMessage, {
      message: log,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    });
  }

  debug(message: any, className: string, methodName: string) {
    const { colorLog, log } = this.logFormat(message, className, methodName, COLOR.fgWhite);
    console.debug(this.isColorLog() ? colorLog : log);
  }

  logFormat(
    text: string,
    className: string,
    methodName: string,
    color,
  ): { colorLog: string; log: string } {
    const now = new Date();
    const date = this.generateText(now.toLocaleString(), COLOR.fgWhite);
    const mName = this.generateText(methodName, COLOR.fgMagenta);
    const cName = this.generateText(`[${className}]`, COLOR.fgYellow);
    const textFormatted = this.generateText(text, color);

    const colorLog = `${date}    ${cName} ${mName} ${textFormatted}`;
    const log = `${now.toLocaleString()}     [${className}] ${methodName} ${text}`;

    return { colorLog, log };
  }

  private generateText(text: string, color): string {
    return `${color}${text}${COLOR.reset}`;
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
      return 'was called';
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

  private isColorLog(): boolean {
    return !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test;
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
  bgRed: '\x1b[31m',
  bgGreen: '\x1b[32m',
  bgYellow: '\x1b[33m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};
