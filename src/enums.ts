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

export enum Platform {
  ios = 'ios',
  android = 'android',
  web = 'web',
}
