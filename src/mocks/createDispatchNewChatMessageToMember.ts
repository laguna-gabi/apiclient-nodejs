import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
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
    dispatchId: generateDispatchId(ContentKey.newChatMessageFromUser, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.chatMessageToMember,
    recipientClientId,
    senderClientId,
    contentKey: ContentKey.newChatMessageFromUser,
    path: `connect/${recipientClientId}/${senderClientId}`,
  };
};
