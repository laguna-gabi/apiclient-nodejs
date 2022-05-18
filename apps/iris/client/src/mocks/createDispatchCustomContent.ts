import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType, validateNotificationTypeText } from '.';
import { ICreateDispatch, InnerQueueTypes, NotifyCustomKey, generateDispatchId } from '..';

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
  const contentKey = NotifyCustomKey.customContent;
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
