import { v4 } from 'uuid';
import {
  AllNotificationTypes,
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateCustomContentNotificationType,
} from '../index';

export type ObjectCustomContentType = ObjectBaseType & Pick<ICreateDispatch, 'content'>;

export class ObjectCustomContentClass {
  constructor(readonly objectCustomContentType: ObjectCustomContentType) {}
}

export const generateObjectCustomContentMock = ({
  recipientClientId,
  senderClientId,
  content,
  notificationType,
}: {
  recipientClientId: string;
  senderClientId: string;
  content: string;
  notificationType: AllNotificationTypes;
}): ObjectCustomContentType => {
  validateCustomContentNotificationType(notificationType);
  const contentKey = CustomKey.customContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    senderClientId,
    contentKey,
    content,
  };
};
