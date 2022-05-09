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

export enum ClientCategory {
  member = 'member',
  user = 'user',
}

export enum Language {
  en = 'en',
  es = 'es',
}

export enum QueueType {
  audit = 'audit',
  notifications = 'notifications',
  transcript = 'transcript',
  entityChange = 'entityChange',
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

/*******************************************************************************
 ***************************** Change Events ***********************************
 ******************************************************************************/
export enum ChangeEventType {
  created = 'created',
  updated = 'updated',
  deleted = 'deleted',
}

export enum EntityName {
  caregiver = 'caregiver',
}

export interface IChangeEvent {
  action: ChangeEventType;
  entity: EntityName;
  memberId: string;
  correlationId: string;
}
