import { AllNotificationTypes, Platform, TriggeredApi } from '.';

export interface IUpdateMemberSettings {
  id: string;
  orgName?: string;
  phone?: string;
  platform?: Platform;
  externalUserId?: string;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
}

export interface IUpdateUserSettings {
  id: string;
  firstName?: string;
  avatar?: string;
}

export interface IDeleteDispatch {
  dispatchId: string;
  correlationId: string;
  memberId?: string;
  userId?: string;
}

export interface ICreateDispatch extends IDeleteDispatch {
  triggeredApi: TriggeredApi;
  notificationType: AllNotificationTypes;
  sendBirdChannelUrl?: string;
  appointmentId?: string;
  peerId?: string;
  content?: string;
  chatLink?: boolean;
  when?: Date;
  notificationId?: string;
}
