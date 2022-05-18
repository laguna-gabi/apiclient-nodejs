import { NotificationType, ServiceName } from '@argus/pandora';
import { ChatInternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

export type ObjectNewChatMessageToMemberType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

export class ObjectNewChatMessageToMemberClass {
  constructor(readonly objectNewChatMessageFromUserType: ObjectNewChatMessageToMemberType) {}
}

export const generateNewChatMessageToMemberMock = ({
  recipientClientId,
  senderClientId,
}: {
  recipientClientId: string;
  senderClientId: string;
}): ObjectNewChatMessageToMemberType => {
  const contentKey = ChatInternalKey.newChatMessageFromUser;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
    path: `connect/${recipientClientId}/${senderClientId}`,
  };
};
