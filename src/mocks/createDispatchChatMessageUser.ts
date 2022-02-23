import {
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  NotifyCustomKey,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectChatMessageUserType = ObjectBaseType &
  Pick<ICreateDispatch, 'sendBirdChannelUrl' | 'content'>;

export class ObjectChatMessageUserClass {
  constructor(readonly objectChatMessageUserType: ObjectChatMessageUserType) {}
}

export const generateChatMessageUserMock = ({
  recipientClientId,
  senderClientId,
  content,
  sendBirdChannelUrl,
}: {
  recipientClientId: string;
  senderClientId: string;
  content: string;
  sendBirdChannelUrl: string;
}): ObjectChatMessageUserType => {
  const contentKey = NotifyCustomKey.customContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.chat,
    recipientClientId,
    senderClientId,
    content,
    contentKey,
    sendBirdChannelUrl,
  };
};
