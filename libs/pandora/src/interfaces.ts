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
  clinicalEngine = 'clinicalEngine',
  poseidon = 'poseidon',
}

export enum Language {
  en = 'en',
  es = 'es',
}

export enum QueueType {
  audit = 'audit',
  notifications = 'notifications',
  transcript = 'transcript',
}

export enum AuditType {
  write = 'write',
  read = 'read',
  archive = 'archive',
  delete = 'delete',
  message = 'message',
  userReplaced = 'userReplaced',
}

export enum GlobalEventType {
  notifySlack = 'notifySlack',
  notifyQueue = 'notifyQueue',
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
