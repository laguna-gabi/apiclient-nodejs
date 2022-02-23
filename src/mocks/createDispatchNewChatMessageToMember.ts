import {
  ChatInternalKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

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
