import { NotificationType, ServiceName } from '@argus/pandora';
import { ICreateDispatch, InnerQueueTypes, NotifyCustomKey, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

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
