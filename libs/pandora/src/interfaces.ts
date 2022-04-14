import { CancelNotificationType, NotificationType, Platform, ServiceName } from '.';

export enum ClientCategory {
  member = 'member',
  user = 'user',
}

export enum InnerQueueTypes {
  updateClientSettings = 'updateClientSettings',
  deleteClientSettings = 'deleteClientSettings',
  createDispatch = 'createDispatch',
  deleteDispatch = 'deleteDispatch',
  updateSenderClientId = 'updateSenderClientId',
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
  zipCode?: string;
  language?: Language;
  platform?: Platform;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
  isRecommendationsEnabled?: boolean;
  isTodoNotificationsEnabled?: boolean;
  externalUserId?: string;
  firstLoggedInAt?: Date;
  //only user
  avatar?: string;
}

export interface IDeleteClientSettings extends IInnerQueueTypes {
  id: string;
  hard: boolean;
}

interface IDispatch extends IInnerQueueTypes {
  dispatchId: string;
  correlationId: string;
}

export interface ICreateDispatch extends IDispatch {
  serviceName: ServiceName;
  notificationType: NotificationType | CancelNotificationType;
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
  assessmentName?: string;
  assessmentScore?: string;
}

export type IDeleteDispatch = IDispatch;

export interface IUpdateSenderClientId extends IInnerQueueTypes {
  recipientClientId: string;
  senderClientId: string;
  correlationId: string;
}

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
  escalation = 'slack.escalation',
  analyticsAutoLoader = 'slack.analyticsAutoLoader',
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

export enum RegisterInternalKey {
  newMember = 'newMember',
  newControlMember = 'newControlMember',
  newMemberNudge = 'newMemberNudge',
  newRegisteredMember = 'newRegisteredMember',
  newRegisteredMemberNudge = 'newRegisteredMemberNudge',
}

export enum AppointmentInternalKey {
  appointmentScheduledMember = 'appointmentScheduledMember',
  appointmentLongReminder = 'appointmentLongReminder',
  appointmentReminder = 'appointmentReminder',
  appointmentReminderLink = 'appointmentReminderLink',
  appointmentRequest = 'appointmentRequest',
  appointmentRequestLink = 'appointmentRequestLink',
  appointmentScheduledUser = 'appointmentScheduledUser',
}

export enum TodoInternalKey {
  createTodoMeds = 'createTodo.Meds',
  createTodoAppointment = 'createTodo.Appointment',
  createTodoTodo = 'createTodo.Todo',
  updateTodoMeds = 'updateTodo.Meds',
  updateTodoAppointment = 'updateTodo.Appointment',
  updateTodoTodo = 'updateTodo.Todo',
  deleteTodoMeds = 'deleteTodo.Meds',
  deleteTodoAppointment = 'deleteTodo.Appointment',
  deleteTodoTodo = 'deleteTodo.Todo',
}

export enum AlertInternalKey {
  assessmentSubmitAlert = 'assessmentSubmitAlert',
}

export enum LogInternalKey {
  logReminder = 'logReminder',
  memberNotFeelingWellMessage = 'memberNotFeelingWellMessage',
}

export enum ChatInternalKey {
  newChatMessageFromUser = 'newChatMessageFromUser',
  newChatMessageFromMember = 'newChatMessageFromMember',
}

export enum NotifyCustomKey {
  customContent = 'customContent',
  callOrVideo = 'callOrVideo',
  cancelNotify = 'cancelNotify',
}

export enum JournalCustomKey {
  journalContent = 'journalContent',
}

export enum ExternalKey {
  addCaregiverDetails = 'addCaregiverDetails',
  setCallPermissions = 'setCallPermissions',
  scheduleAppointment = 'scheduleAppointment',
  answerQuestionnaire = 'answerQuestionnaire',
}

export type ContentKey =
  | RegisterInternalKey
  | AppointmentInternalKey
  | TodoInternalKey
  | AlertInternalKey
  | LogInternalKey
  | ChatInternalKey
  | NotifyCustomKey
  | JournalCustomKey
  | ExternalKey;

export enum Categories {
  register = 'register',
  appointment = 'appointment',
  todo = 'todo',
  alert = 'alert',
  log = 'log',
  chat = 'chat',
  notify = 'notify',
  journal = 'journal',
  external = 'external',
}

const mapReducer = (arr, [keys, val]) => [
  ...arr,
  ...(Array.isArray(keys) ? [...keys.map((key) => [key, val])] : [[keys, val]]),
];

export const ContentCategories: Map<ContentKey, Categories> = new Map(
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  [
    [Object.values(RegisterInternalKey), Categories.register],
    [Object.values(AppointmentInternalKey), Categories.appointment],
    [Object.values(TodoInternalKey), Categories.todo],
    [Object.values(AlertInternalKey), Categories.alert],
    [Object.values(LogInternalKey), Categories.log],
    [Object.values(ChatInternalKey), Categories.chat],
    [Object.values(NotifyCustomKey), Categories.notify],
    [Object.values(JournalCustomKey), Categories.journal],
    [Object.values(ExternalKey), Categories.external],
  ].reduce(mapReducer, []),
);

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
 *********************************** Logger ***********************************
 ******************************************************************************/

export class Client {
  id?: string;
  authId?: string;
  roles?: string[];
}

export class FailureReason {
  message?: string;
  code?: number;
  stack?: string;
  data?: string;
}
