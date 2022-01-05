import {
  ICreateDispatch,
  InnerQueueTypes,
  InternalKey,
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
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(InternalKey.newChatMessageFromUser, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey: InternalKey.newChatMessageFromUser,
    path: `connect/${recipientClientId}/${senderClientId}`,
  };
};
