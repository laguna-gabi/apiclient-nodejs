import {
  ContentKey,
  Honorific,
  Language,
  NotificationType,
  Platform,
  ServiceName,
} from '@lagunahealth/pandora';
import { add } from 'date-fns';
import { internet, lorem, name } from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { Dispatch, Trigger, defaultDispatchParams } from '../src/conductor';
import { ClientSettings } from '../src/settings';

export const delay = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const generateObjectId = (id?): Types.ObjectId => {
  return new Types.ObjectId(id);
};

export const generateId = (id?): string => {
  return generateObjectId(id).toString();
};

export const generateUpdateMemberSettingsMock = ({
  id = generateId(),
  isAppointmentsReminderEnabled = true,
}: {
  id?: string;
  isAppointmentsReminderEnabled?: boolean;
} = {}): Omit<ClientSettings, 'avatar'> => {
  return {
    id,
    phone: generatePhone(),
    firstName: name.firstName(),
    lastName: name.lastName(),
    orgName: name.firstName(),
    honorific: Honorific.reverend,
    zipCode: '91210',
    language: Language.en,
    platform: Platform.web,
    isPushNotificationsEnabled: false,
    isAppointmentsReminderEnabled,
    isRecommendationsEnabled: true,
    externalUserId: v4(),
    firstLoggedInAt: new Date(),
  };
};

export const generateUpdateUserSettingsMock = (): Pick<
  ClientSettings,
  'id' | 'phone' | 'firstName' | 'lastName' | 'avatar'
> => {
  return {
    id: v4(),
    phone: generatePhone(),
    firstName: name.firstName(),
    lastName: name.lastName(),
    avatar: internet.avatar(),
  };
};

export const generateDispatch = ({
  dispatchId = v4(),
  correlationId = v4(),
  serviceName = ServiceName.hepius,
  notificationType = NotificationType.text,
  recipientClientId = v4(),
  senderClientId = v4(),
  sendBirdChannelUrl = internet.url(),
  appointmentId = v4(),
  peerId = v4(),
  contentKey = ContentKey.newMember,
  content = lorem.sentence(),
  chatLink = true,
  path = `connect/${generateId()}`,
  triggersAt = add(new Date(), { seconds: 1 }),
  triggeredId = v4(),
  notificationId = v4(),
  status = defaultDispatchParams.status,
  deliveredAt = add(new Date(), { seconds: 2 }),
  retryCount = defaultDispatchParams.retryCount,
  failureReasons = [lorem.sentence()],
}: Partial<Dispatch> = {}): Dispatch => {
  return {
    dispatchId,
    correlationId,
    serviceName,
    notificationType,
    recipientClientId,
    senderClientId,
    sendBirdChannelUrl,
    appointmentId,
    peerId,
    contentKey,
    content,
    chatLink,
    path,
    triggersAt,
    triggeredId,
    notificationId,
    status,
    deliveredAt,
    retryCount,
    failureReasons,
  };
};

export const generateTriggers = ({
  dispatchId = v4(),
  expireAt = add(new Date(), { seconds: 2 }),
} = {}): Trigger => {
  return {
    dispatchId,
    expireAt,
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
