import {
  ICreateDispatch,
  IDeleteDispatch,
  IUpdateClientSettings,
  InnerQueueTypes,
  NotificationType,
  Platform,
  SourceApi,
  TriggeredApi,
} from '@lagunahealth/pandora';
import { add } from 'date-fns';
import * as faker from 'faker';
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
    senderClientId,
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

export const generateUpdateClientSettingsParams = ({
  type = InnerQueueTypes.updateClientSettings,
  id = generateId(),
  orgName = lorem.word(),
  phone = generatePhone(),
  platform = Platform.web,
  externalUserId = v4(),
  isPushNotificationsEnabled = false,
  isAppointmentsReminderEnabled = false,
  firstName = name.firstName(),
  avatar = image.avatar(),
}: Partial<IUpdateClientSettings> = {}): IUpdateClientSettings => {
  return {
    type,
    id,
    orgName,
    phone,
    platform,
    externalUserId,
    isPushNotificationsEnabled,
    isAppointmentsReminderEnabled,
    firstName,
    avatar,
  };
};

export const generateCreateDispatchParams = ({
  type = InnerQueueTypes.createDispatch,
  dispatchId = generateId(),
  correlationId = v4(),
  triggeredApi = TriggeredApi.graphql,
  sourceApi = SourceApi.hepius,
  notificationType = NotificationType.call,
  recipientClientId = v4(),
  senderClientId = v4(),
  sendBirdChannelUrl = faker.internet.url(),
  appointmentId = generateId(),
  peerId = v4(),
  content = faker.lorem.sentence(),
  chatLink = false,
  triggeredAt = new Date(),
  notificationId = v4(),
  path = 'call',
}: Partial<ICreateDispatch> = {}): ICreateDispatch => {
  return {
    type,
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
    path,
  };
};

export const generateDeleteDispatchParams = ({
  type = InnerQueueTypes.deleteDispatch,
  dispatchId = generateId(),
}: Partial<IDeleteDispatch> = {}): IDeleteDispatch => {
  return {
    type,
    dispatchId,
  };
};
