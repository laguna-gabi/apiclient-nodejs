import { NotificationType, Platform, SourceApi, TriggeredApi } from '@lagunahealth/pandora';
import { add } from 'date-fns';
import { internet, lorem, name } from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { ClientSettings } from '../src/settings';
import { Dispatch, Trigger, defaultDispatchParams } from '../src/conductor';

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateClientSettings = ({
  id = generateId(),
  orgName = lorem.word(),
  phone = generatePhone(),
  platform = Platform.web,
  externalUserId = v4(),
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
}: Partial<ClientSettings> = {}): ClientSettings => {
  return {
    id,
    orgName,
    phone,
    platform,
    externalUserId,
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
  };
};

export const generateDispatch = ({
  dispatchId = v4(),
  correlationId = v4(),
  triggeredApi = TriggeredApi.graphql,
  sourceApi = SourceApi.hepius,
  notificationType = NotificationType.text,
  recipientClientId = v4(),
  senderClient = { id: v4(), firstName: name.firstName(), avatar: internet.avatar() },
  sendBirdChannelUrl = internet.url(),
  appointmentId = v4(),
  peerId = v4(),
  content = lorem.sentence(),
  chatLink = true,
  path = `connect/${generateId()}`,
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
    senderClient,
    sendBirdChannelUrl,
    appointmentId,
    peerId,
    content,
    chatLink,
    path,
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

export const generatePath = (type: NotificationType) => {
  return type === NotificationType.call || type === NotificationType.video ? { path: 'call' } : {};
};

export const generatePhone = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phone = '+414';
  for (let i = 0; i < 8; i++) {
    phone += random().toString();
  }

  return phone;
};
