import { ClientCategory, Language, Platform, generatePhone } from '@argus/pandora';
import { internet, name } from 'faker';
import { isUndefined, omitBy } from 'lodash';
import { v4 } from 'uuid';
import { IUpdateClientSettings, InnerQueueTypes } from '..';

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
