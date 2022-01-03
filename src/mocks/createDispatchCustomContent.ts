import { v4 } from 'uuid';
import {
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateNotificationTypeText,
} from '../index';

export type ObjectCustomContentType = ObjectBaseType &
  Pick<ICreateDispatch, 'content' | 'sendBirdChannelUrl'>;

export class ObjectCustomContentClass {
  constructor(readonly objectCustomContentType: ObjectCustomContentType) {}
}

export const generateObjectCustomContentMock = ({
  recipientClientId,
  senderClientId,
  content,
  notificationType,
  sendBirdChannelUrl,
}: {
  recipientClientId: string;
  senderClientId: string;
  content: string;
  notificationType: NotificationType;
  sendBirdChannelUrl: string;
}): ObjectCustomContentType => {
  validateNotificationTypeText(notificationType);
  const contentKey = CustomKey.customContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    contentKey,
    content,
    sendBirdChannelUrl,
  };
};
