/*******************************************************************************
 *********************************** General ***********************************
 ******************************************************************************/
export enum Environments {
  production = 'production',
  develop = 'develop',
  test = 'test',
  localhost = 'localhost',
}

export enum ServiceName {
  hepius = 'hepius',
  iris = 'iris',
}

export enum Language {
  en = 'en',
  es = 'es',
}

export enum QueueType {
  audit = 'audit',
  notifications = 'notifications',
}

export enum AuditType {
  write = 'write',
  read = 'read',
  archive = 'archive',
  delete = 'delete',
  message = 'message',
  userReplaced = 'userReplaced',
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
 ***************************** Notification types ******************************
 ******************************************************************************/
export enum NotificationType {
  video = 'video',
  call = 'call',
  text = 'text',
  textSms = 'textSms',
  chat = 'chat',
}

export enum CancelNotificationType {
  cancelVideo = 'cancelVideo',
  cancelCall = 'cancelCall',
  cancelText = 'cancelText',
}

/*******************************************************************************
 ************************************ Config ***********************************
 ******************************************************************************/

export const BaseExternalConfigs = {
  aws: {
    queueNameNotifications: 'aws.sqs.queueNameNotifications',
    queueNameAudit: 'aws.sqs.queueNameAudit',
  },
  oneSignal: {
    defaultApiId: 'onesignal.default.apiId',
    defaultApiKey: 'onesignal.default.apiKey',
    voipApiId: 'onesignal.voip.apiId',
    voipApiKey: 'onesignal.voip.apiKey',
  },
  slack: {
    url: 'slack.url',
  },
  sendbird: {
    apiId: 'sendbird.apiId',
    apiToken: 'sendbird.apiToken',
    masterApiToken: 'sendbird.masterApiToken',
  },
  bitly: {
    apiToken: 'bitly.apiToken',
    groupGuid: 'bitly.groupGuid',
  },
};
