import { AllNotificationTypes, Platform, SourceApi, TriggeredApi } from '.';

export interface IUpdateClientSettings {
  id: string;
  orgName?: string;
  phone?: string;
  platform?: Platform;
  externalUserId?: string;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
  firstName?: string;
  avatar?: string;
}

interface IDispatch {
  dispatchId: string;
}

export interface ICreateDispatch extends IDispatch {
  correlationId: string;
  triggeredApi: TriggeredApi;
  sourceApi: SourceApi;
  notificationType: AllNotificationTypes;
  recipientClientId: string;
  senderClientId?: string;
  sendBirdChannelUrl?: string;
  appointmentId?: string;
  peerId?: string;
  content?: string;
  chatLink?: boolean;
  triggeredAt?: Date;
  notificationId?: string;
}

export type IDeleteDispatch = IDispatch;

export const BaseExternalConfigs = {
  oneSignal: {
    defaultApiId: 'onesignal.default.apiId',
    defaultApiKey: 'onesignal.default.apiKey',
    voipApiId: 'onesignal.voip.apiId',
    voipApiKey: 'onesignal.voip.apiKey',
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
  channel: string; //todo figure out a better way for this
}
