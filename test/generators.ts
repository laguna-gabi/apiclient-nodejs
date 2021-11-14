import { Platform } from '@lagunahealth/pandora';
import { image, name, phone } from 'faker';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { ClientSettings } from '../src/settings';

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
