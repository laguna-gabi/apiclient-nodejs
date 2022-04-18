import { NotificationType } from '@argus/pandora';
import { ContentKey } from '../interfaces';

export const validateNotificationTypeText = (notificationType: NotificationType) => {
  if (notificationType !== NotificationType.textSms && notificationType !== NotificationType.text) {
    throw Error(
      `invalid notificationType - ${notificationType} - should be ${
        (NotificationType.text, NotificationType.textSms)
      }`,
    );
  }
};

export const validateContentKey = (allowedContentKeys: Set<ContentKey>, contentKey: ContentKey) => {
  if (!allowedContentKeys.has(contentKey)) {
    throw Error(`invalid ${contentKey} - should be ${Array.from(allowedContentKeys.values())}`);
  }
};
