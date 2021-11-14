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
