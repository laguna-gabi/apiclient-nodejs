import { AllNotificationTypes, Platform, ServiceName } from '.';

export enum ClientCategory {
  member = 'member',
  user = 'user',
}

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
  clientCategory: ClientCategory;
  phone?: string;
  firstName?: string;
  lastName?: string;
  //only member
  orgName?: string;
  honorific?: Honorific;
  zipCode?: string;
  language?: Language;
  platform?: Platform;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
  isRecommendationsEnabled?: boolean;
  externalUserId?: string;
  firstLoggedInAt?: Date;
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
  serviceName: ServiceName;
  notificationType: AllNotificationTypes;
  recipientClientId: string;
  senderClientId?: string;
  sendBirdChannelUrl?: string;
  appointmentId?: string;
  appointmentTime?: Date;
  peerId?: string;
  contentKey?: ContentKey;
  content?: string;
  chatLink?: string;
  triggersAt?: Date;
  path?: string;
  scheduleLink?: string;
  journalImageDownloadLink?: string;
  journalAudioDownloadLink?: string;
}

export type IDeleteDispatch = IDispatch;

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
  header: string;
  message: string;
  icon: SlackIcon;
  channel: string;
  orgName?: string;
}

export enum ExternalKey {
  addCaregiverDetails = 'addCaregiverDetails',
  setCallPermissions = 'setCallPermissions',
}

export enum InternalKey {
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

export enum CustomKey {
  customContent = 'customContent',
  callOrVideo = 'callOrVideo',
  cancelNotify = 'cancelNotify',
  journalContent = 'journalContent',
}

export type ContentKey = ExternalKey | InternalKey | CustomKey;

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
  appointmentStart?: string;
  gapMinutes?: string;
  appointmentTime?: string;
  chatLink?: string;
  scheduleLink?: string;
  dynamicLink?: string;
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
 *********************************** Logger ***********************************
 ******************************************************************************/

export class Client {
  id?: string;
  authId?: string;
  roles?: string[];
}

export class FailureReason {
  message?: any;
  code?: any;
  stack?: any;
  data?: any;
}
