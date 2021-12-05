import {
  Honorific,
  IUpdateClientSettings,
  InnerQueueTypes,
  Language,
  Platform,
  generatePhone,
} from '../index';
import { v4 } from 'uuid';
import { name } from 'faker';

export type UpdateMemberSettingsType = Omit<IUpdateClientSettings, 'avatar'>;
export type UpdateUserSettingsType = Omit<
  IUpdateClientSettings,
  'id' | 'phone' | 'firstName' | 'lastName' | 'avatar'
>;

export class ObjectUpdateMemberSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export class ObjectUpdateUserSettingsClass {
  constructor(readonly objectUpdateMemberSettings: UpdateMemberSettingsType) {}
}

export const generateUpdateMemberSettingsMock = (): UpdateMemberSettingsType => {
  return {
    type: InnerQueueTypes.updateClientSettings,
    id: v4(),
    phone: generatePhone(),
    firstName: name.firstName(),
    lastName: name.lastName(),
    //only member
    orgName: name.firstName(),
    platform: Platform.web,
    isPushNotificationsEnabled: false,
    isAppointmentsReminderEnabled: true,
    isRecommendationsEnabled: true,
    externalUserId: v4(),
    firstLoggedInAt: new Date(),
    honorific: Honorific.reverend,
    zipCode: '91210',
    language: Language.en,
  };
};
