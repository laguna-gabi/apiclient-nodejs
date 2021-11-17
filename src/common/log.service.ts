import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { cloneDeep } from 'lodash';
import {
  AuditType,
  Environments,
  EventType,
  IEventQueueMessage,
  QueueType,
  SlackChannel,
  SlackIcon,
  generateOrgNamePrefix,
} from '.';

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
    'sendBirdChannelUrl',
    'senderUserId',
    'deviceId',
    //baseSchedulers
    'schedulerIdentifier',
    'lengthResults',
    //sendbird create user params
    'channel_url',
    'cover_url',
    'inviter_id',
    'user_ids',
    'user_id',
    //general finish method time
    'finishedAndItTook',
    //slackbot
    'channel',
    //replace user
    'newUserId',
    'oldUserId',
    //sendbird webhook
    'sender',
  ];

  log(params: any = {}, className: string, methodName: string) {
    const { colorLog, log } = this.logFormat(
      this.getCalledLog(params),
      className,
      methodName,
      LogType.log,
      COLOR.fgWhite,
    );

    console.info(this.isColorLog() ? colorLog : log);
  }

  warn(params: any = {}, className: string, methodName: string, ...reasons: any[]) {
    const { colorLog, log } = this.logFormat(
      `${this.getCalledLog(params)} WARN with result ${reasons}`,
      className,
      methodName,
      LogType.warn,
      COLOR.fgYellow,
      params?.orgName,
    );
    console.warn(this.isColorLog() ? colorLog : log);

    this.eventEmitter.emit(EventType.slackMessage, {
      message: log,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    });
  }

  error(params: any = {}, className: string, methodName: string, ...reasons: any[]) {
    const { colorLog, log } = this.logFormat(
      `${this.getCalledLog(params)} FAILED with result ${reasons}`,
      className,
      methodName,
      LogType.error,
      COLOR.fgRed,
      params?.orgName,
    );
    console.error(this.isColorLog() ? colorLog : log);

    this.eventEmitter.emit(EventType.slackMessage, {
      message: log,
      icon: SlackIcon.critical,
      channel: SlackChannel.notifications,
    });
  }

  debug(params: any = {}, className: string, methodName: string) {
    const { colorLog, log } = this.logFormat(
      this.getCalledLog(params),
      className,
      methodName,
      LogType.debug,
      COLOR.fgWhite,
    );
    console.debug(this.isColorLog() ? colorLog : log);
  }

  audit(type: AuditType, params, methodName: string, authId?: string) {
    const eventParams: IEventQueueMessage = {
      type: QueueType.audit,
      message:
        `user: ${authId}, type: ${type}, date: ${new Date().toLocaleString()}, description: ` +
        `Hepius ${methodName} ${this.getCalledLog(params)}`,
    };
    this.eventEmitter.emit(EventType.queueMessage, eventParams);
  }

  /**
   * @params is the input of params to the method.
   * @params can be:
   * 1. object of key value pairs : params = {memberId: '123abc', type: 'call'}
   *    we'll keep only the hipaa compliance fields. for example-'firstName' will not be logged.
   * 2. a string value representing an id: params = '123abc'
   *    we'll log this id.
   */
  private getCalledLog(params) {
    if (!params || Object.keys(params).length === 0) {
      return 'was called';
    }

    if (params.finishedAndItTook) {
      return `finished in ${params.finishedAndItTook}`;
    }

    const dupParams = cloneDeep(params);
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

  private logFormat(
    text: string,
    className: string,
    methodName: string,
    logType: LogType,
    color,
    orgName?: string,
  ): { colorLog: string; log: string } {
    const now = new Date();
    const date = this.generateText(now.toLocaleString(), COLOR.fgWhite);
    const mName = this.generateText(methodName, COLOR.fgMagenta);
    const cName = this.generateText(`[${className}]`, COLOR.fgYellow);
    const lType = this.generateText(`[${logType}]`.padEnd(11), COLOR.fgWhite);
    const textFormatted = this.generateText(text, color);

    const colorLog = `${date}   ${lType} ${cName} ${mName} ${textFormatted}`;
    const log = `${now.toLocaleString()}   [${logType}] [${className}]${generateOrgNamePrefix(
      orgName,
    )}${methodName} ${text}`;

    return { colorLog, log };
  }

  private generateText(text: string, color): string {
    return `${color}${text}${COLOR.reset}`;
  }

  private isColorLog(): boolean {
    return !process.env.NODE_ENV || process.env.NODE_ENV === Environments.test;
  }
}

enum LogType {
  log = 'log',
  warn = 'warn',
  error = 'error',
  debug = 'debug',
}

const COLOR = {
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

export const internalLogs = {
  hepiusVersion: 'Starting Hepius application version: @version@',
  lastCommit: 'Last commit hash on this branch is: @hash@',
  schedulerLeader:
    'Current instance is now leader of @type@ scheduler with identifier: @identifier@',
};
