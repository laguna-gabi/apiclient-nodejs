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
  correlationId?: string;
  memberId?: string;
  userId?: string;
}

export interface ICreateDispatch extends IDispatch {
  triggeredApi: TriggeredApi;
  sourceApi: SourceApi;
  notificationType: AllNotificationTypes;
  sendBirdChannelUrl?: string;
  appointmentId?: string;
  peerId?: string;
  content?: string;
  chatLink?: boolean;
  when?: Date;
  notificationId?: string;
}

export type IDeleteDispatch = IDispatch;
