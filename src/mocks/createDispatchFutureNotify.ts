import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateNotificationTypeText,
} from '../';
import { v4 } from 'uuid';

export type ObjectFutureNotifyType = ObjectBaseType &
  Pick<ICreateDispatch, 'notificationType' | 'triggersAt' | 'sendBirdChannelUrl'>;

export class ObjectFutureNotifyClass {
  constructor(readonly objectFutureNotifyType: ObjectFutureNotifyType) {}
}

export const generateObjectFutureNotifyMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
  notificationType,
  triggersAt,
  sendBirdChannelUrl,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
  notificationType: NotificationType;
  triggersAt: Date;
  sendBirdChannelUrl: string;
}): ObjectFutureNotifyType => {
  validateNotificationTypeText(notificationType);
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
  };
};
