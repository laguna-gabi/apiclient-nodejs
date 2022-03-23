import {
  ClientCategory,
  Honorific,
  IUpdateClientSettings,
  InnerQueueTypes,
  Language,
  Platform,
  generatePhone,
} from '../index';
import { v4 } from 'uuid';
import { internet, name } from 'faker';
import { isUndefined, omitBy } from 'lodash';

export type UpdateMemberSettingsType = Omit<IUpdateClientSettings, 'avatar'>;
export type UpdateUserSettingsType = Pick<
  IUpdateClientSettings,
  'id' | 'clientCategory' | 'type' | 'phone' | 'firstName' | 'lastName' | 'avatar'
>;

export class ObjectUpdateMemberSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export class ObjectUpdateUserSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export const generateUpdateMemberSettingsMock = ({
  id,
  phone,
  firstName,
  lastName,
  orgName,
  honorific,
  zipCode,
  language,
  platform,
  isPushNotificationsEnabled,
  isAppointmentsReminderEnabled,
  isRecommendationsEnabled,
  isTodoNotificationsEnabled,
  externalUserId,
  firstLoggedInAt,
}: {
  id?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  orgName?: string;
  honorific?: Honorific;
  zipCode?: string;
  language?: Language;
  platform?: Platform;
  isPushNotificationsEnabled?: boolean;
  isAppointmentsReminderEnabled?: boolean;
  isRecommendationsEnabled?: boolean;
  isTodoNotificationsEnabled?: boolean;
  externalUserId?: string;
  firstLoggedInAt?: Date;
} = {}): UpdateMemberSettingsType => {
  return omitBy(
    {
      type: InnerQueueTypes.updateClientSettings,
      id,
      clientCategory: ClientCategory.member,
      phone,
      firstName,
      lastName,
      orgName,
      honorific,
      zipCode,
      language,
      platform,
      isPushNotificationsEnabled,
      isAppointmentsReminderEnabled,
      isRecommendationsEnabled,
      isTodoNotificationsEnabled,
      externalUserId,
      firstLoggedInAt,
    },
    isUndefined,
  );
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
    clientCategory: ClientCategory.user,
    phone,
    firstName,
    lastName,
    avatar,
  };
};
