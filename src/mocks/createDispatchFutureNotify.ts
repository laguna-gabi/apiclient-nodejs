import { v4 } from 'uuid';
import {
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  NotifyCustomKey,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateNotificationTypeText,
} from '../';

export type ObjectFutureNotifyType = ObjectBaseType &
  Pick<ICreateDispatch, 'notificationType' | 'triggersAt' | 'sendBirdChannelUrl' | 'content'>;

export class ObjectFutureNotifyClass {
  constructor(readonly objectFutureNotifyType: ObjectFutureNotifyType) {}
}

export const generateObjectFutureNotifyMock = ({
  recipientClientId,
  senderClientId,
  notificationType,
  triggersAt,
  sendBirdChannelUrl,
  content,
}: {
  recipientClientId: string;
  senderClientId: string;
  notificationType: NotificationType;
  triggersAt: Date;
  sendBirdChannelUrl: string;
  content: string;
}): ObjectFutureNotifyType => {
  validateNotificationTypeText(notificationType);
  const contentKey = NotifyCustomKey.customContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    senderClientId,
    triggersAt,
    contentKey,
    sendBirdChannelUrl,
    content,
  };
};
