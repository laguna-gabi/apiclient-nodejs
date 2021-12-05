import { AllNotificationTypes, Platform, SourceApi } from '.';

export enum InnerQueueTypes {
  updateClientSettings = 'updateClientSettings',
  deleteClientSettings = 'deleteClientSettings',
  createDispatch = 'createDispatch',
  deleteDispatch = 'deleteDispatch',
}

export interface IInnerQueueTypes {
  type: InnerQueueTypes;
}

export interface IUpdateClientSettings extends IInnerQueueTypes {
  id: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  //only member
  orgName?: string;
  platform?: Platform;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
  isRecommendationsEnabled?: boolean;
  externalUserId?: string;
  firstLoggedInAt?: Date;
  honorific?: Honorific;
  zipCode?: string;
  language?: Language;
  //only user
  avatar?: string;
}

export interface IDeleteClientSettings extends IInnerQueueTypes {
  id: string;
}

interface IDispatch extends IInnerQueueTypes {
  dispatchId: string;
}

export interface ICreateDispatch extends IDispatch {
  correlationId: string;
  sourceApi: SourceApi;
  notificationType: AllNotificationTypes;
  recipientClientId: string;
  senderClientId?: string;
  sendBirdChannelUrl?: string;
  appointmentId?: string;
  appointmentTime?: Date;
  peerId?: string;
  contentKey?: ContentKey;
  chatLink?: boolean;
  triggeredAt?: Date;
  notificationId?: string;
  path?: string;
}

export type IDeleteDispatch = IDispatch;

export const BaseExternalConfigs = {
  aws: {
    queueNameNotifications: `aws.sqs.queueNameNotifications`,
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

/*******************************************************************************
 ************************************ Slack ************************************
 ******************************************************************************/
export enum SlackChannel {
  support = 'slack.support',
  testingSms = 'slack.testingSms',
  notifications = 'slack.notifications',
}

export enum SlackIcon {
  phone = ':telephone_receiver:',
  info = ':information_source:',
  warning = ':warning:',
  critical = ':no_entry:',
  exclamationPoint = ':exclamation:',
  questionMark = ':question:',
}

export interface IEventNotifySlack {
  message: string;
  icon: SlackIcon;
  channel: string;
}

export enum ContentKey {
  newMember = 'newMember',
  newControlMember = 'newControlMember',
  newMemberNudge = 'newMemberNudge',
  newRegisteredMember = 'newRegisteredMember',
  newRegisteredMemberNudge = 'newRegisteredMemberNudge',
  appointmentScheduledMember = 'appointmentScheduledMember',
  appointmentLongReminder = 'appointmentLongReminder',
  appointmentReminder = 'appointmentReminder',
  appointmentReminderLink = 'appointmentReminderLink',
  appointmentRequest = 'appointmentRequest',
  appointmentRequestLink = 'appointmentRequestLink',
  newChatMessageFromUser = 'newChatMessageFromUser',
  logReminder = 'logReminder',
  newChatMessageFromMember = 'newChatMessageFromMember',
  appointmentScheduledUser = 'appointmentScheduledUser',
  memberNotFeelingWellMessage = 'memberNotFeelingWellMessage',
}

export enum Language {
  en = 'en',
  es = 'es',
}

export enum Honorific {
  mr = 'mr',
  mrs = 'mrs',
  ms = 'ms',
  miss = 'miss',
  mx = 'mx',
  dr = 'dr',
  reverend = 'reverend',
  professor = 'professor',
  captain = 'captain',
  coach = 'coach',
  father = 'father',
}

export class ExtraData {
  org?: { name: string };
  downloadLink?: string;
  appointmentStart?: string;
  gapMinutes?: string;
  appointmentTime?: string;
  chatLink?: string;
  scheduleLink?: string;
}
