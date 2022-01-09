import { v4 } from 'uuid';

/*******************************************************************************
 *********************************** General ***********************************
 ******************************************************************************/
export enum Environments {
  production = 'production',
  development = 'development',
  test = 'test',
  localhost = 'localhost',
}

/*******************************************************************************
 *********************************** Member ************************************
 ******************************************************************************/
export enum Platform {
  ios = 'ios',
  android = 'android',
  web = 'web',
}

/*******************************************************************************
 ********************************** Dispatch ***********************************
 ******************************************************************************/
export enum ServiceName {
  hepius = 'hepius',
  iris = 'iris',
}

/*******************************************************************************
 ***************************** Notification types ******************************
 ******************************************************************************/
export enum NotificationType {
  video = 'video',
  call = 'call',
  text = 'text',
  textSms = 'textSms',
}

export enum CancelNotificationType {
  cancelVideo = 'cancelVideo',
  cancelCall = 'cancelCall',
  cancelText = 'cancelText',
}

export enum InternalNotificationType {
  chatMessageToUser = 'chatMessageToUser',
  chatMessageJournal = 'chatMessageJournal',
}

export type AllNotificationTypes =
  | NotificationType
  | CancelNotificationType
  | InternalNotificationType;

/*******************************************************************************
 *********************************** Logger ***********************************
 ******************************************************************************/

export enum LogType {
  log = 'log',
  info = 'info',
  warn = 'warn',
  error = 'error',
  debug = 'debug',
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
          messageFormat: '[{className}] [{methodName}] {reasons}',
          ignore: 'pid,hostname,className,methodName,reasons',
        }
      : false,
};
