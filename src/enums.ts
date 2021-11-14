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
export enum TriggeredApi {
  graphql = 'graphql',
  rest = 'rest',
  internal = 'internal',
}

export enum SourceApi {
  hepius = 'hepius',
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
  textToMember = 'textToMember',
  textSmsToMember = 'textSmsToMember',
  textSmsToUser = 'textSmsToUser',
  chatMessageToMember = 'chatMessageToMember',
  chatMessageToUser = 'chatMessageToUser',
}

export type AllNotificationTypes =
  | NotificationType
  | CancelNotificationType
  | InternalNotificationType;
