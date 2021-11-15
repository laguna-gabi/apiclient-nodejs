import { NotificationType, Platform, SourceApi, TriggeredApi } from '@lagunahealth/pandora';
import { add } from 'date-fns';
import { image, internet, lorem, name, phone } from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { Dispatch, defaultDispatchParams } from '../src/dispatches';
import { ClientSettings } from '../src/settings';
import { Trigger } from '../src/triggers';

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateClientSettings = ({
  id = generateId(),
  platform = Platform.web,
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
  firstName = name.firstName(),
  avatar = image.avatar(),
}: Partial<ClientSettings> = {}): ClientSettings => {
  return {
    id,
    orgName: name.title(),
    phone: phone.phoneNumber(),
    platform,
    externalUserId: v4(),
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
    firstName,
    avatar,
  };
};

export const generateDispatch = ({
  dispatchId = v4(),
  correlationId = v4(),
  triggeredApi = TriggeredApi.graphql,
  sourceApi = SourceApi.hepius,
  notificationType = NotificationType.text,
  recipientClientId = v4(),
  senderClientId = v4(),
  sendBirdChannelUrl = internet.url(),
  appointmentId = v4(),
  peerId = v4(),
  content = lorem.sentence(),
  chatLink = true,
  triggeredAt = add(new Date(), { seconds: 1 }),
  notificationId = v4(),
  status = defaultDispatchParams.status,
  deliveredAt = add(new Date(), { seconds: 2 }),
  retryCount = defaultDispatchParams.retryCount,
  failureReason = lorem.sentence(),
}: Partial<Dispatch> = {}): Dispatch => {
  return {
    dispatchId,
    correlationId,
    triggeredApi,
    sourceApi,
    notificationType,
    recipientClientId,
    senderClientId,
    sendBirdChannelUrl,
    appointmentId,
    peerId,
    content,
    chatLink,
    triggeredAt,
    notificationId,
    status,
    deliveredAt,
    retryCount,
    failureReason,
  };
};

export const generateTriggers = ({
  dispatchId = v4(),
  expiresAt = add(new Date(), { seconds: 2 }),
} = {}): Trigger => {
  return {
    dispatchId,
    expiresAt,
  };
};
