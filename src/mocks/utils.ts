import { address } from 'faker';
import { lookup } from 'zipcode-to-timezone';
import { AllNotificationTypes, InternalNotificationType, NotificationType } from '../enums';

export const generatePhone = () => {
  const random = () => Math.floor(Math.random() * 9) + 1;

  let phone = '+414';
  for (let i = 0; i < 8; i++) {
    phone += random().toString();
  }

  return phone;
};

export const generateZipCode = (): string => {
  while (true) {
    const zipCode = address.zipCode('#####');
    /**
     * On occasions, faker generates invalid zipcodes. we'll try to generate
     * timezone, if it worked, we'll return the zipCode and exit the loop
     * Usually this works in the 1st time, so rarely we'll do it twice.
     */
    const timeZone = lookup(zipCode);
    if (timeZone) {
      return zipCode;
    }
  }
};

export const validateNotificationTypeText = (notificationType: NotificationType) => {
  if (notificationType !== NotificationType.textSms && notificationType !== NotificationType.text) {
    throw Error(
      `invalid notificationType - ${notificationType} - should be ${
        (NotificationType.text, NotificationType.textSms)
      }`,
    );
  }
};

export const validateCustomContentNotificationType = (notificationType: AllNotificationTypes) => {
  if (
    notificationType !== NotificationType.textSms &&
    notificationType !== NotificationType.text &&
    notificationType !== InternalNotificationType.chatMessageToUser
  ) {
    throw Error(
      `invalid notificationType - ${notificationType} - should be ${
        (NotificationType.text,
        NotificationType.textSms,
        InternalNotificationType.chatMessageToUser)
      }`,
    );
  }
};
