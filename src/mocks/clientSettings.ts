import {
  Honorific,
  IUpdateClientSettings,
  InnerQueueTypes,
  Language,
  Platform,
  generatePhone,
  generateZipCode,
} from '../index';
import { v4 } from 'uuid';
import { internet, name } from 'faker';

export type UpdateMemberSettingsType = Omit<IUpdateClientSettings, 'avatar'>;
export type UpdateUserSettingsType = Pick<
  IUpdateClientSettings,
  'id' | 'type' | 'phone' | 'firstName' | 'lastName' | 'avatar'
>;

export class ObjectUpdateMemberSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export class ObjectUpdateUserSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export const generateUpdateMemberSettingsMock = ({
  id = v4(),
  phone = generatePhone(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  orgName = name.firstName(),
  honorific = Honorific.reverend,
  zipCode = generateZipCode(),
  language = Language.en,
}: {
  id?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  orgName?: string;
  honorific?: Honorific;
  zipCode?: string;
  language?: Language;
} = {}): UpdateMemberSettingsType => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id,
    phone,
    firstName,
    lastName,
    orgName,
    honorific,
    zipCode,
    language,
    platform: Platform.web,
    isPushNotificationsEnabled: true,
    isAppointmentsReminderEnabled: true,
    isRecommendationsEnabled: true,
    externalUserId: v4(),
    firstLoggedInAt: new Date(),
  };
};

export const generateUpdateUserSettingsMock = ({
  id = v4(),
  phone = generatePhone(),
  firstName = name.firstName(),
  lastName = name.lastName(),
  avatar = internet.avatar(),
}: {
  id?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
} = {}): UpdateUserSettingsType => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id,
    phone,
    firstName,
    lastName,
    avatar,
  };
};
