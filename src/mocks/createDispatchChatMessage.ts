import {
  ContentKey,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export const generateChatMessageMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
}): ObjectBaseType => {
  if (
    contentKey !== ContentKey.newChatMessageFromMember &&
    contentKey !== ContentKey.newChatMessageFromUser
  ) {
    throw Error(
      `invalid ${contentKey} - should be ${ContentKey.newChatMessageFromMember} ` +
        `or ${ContentKey.newChatMessageFromUser}`,
    );
  }

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType:
      contentKey === ContentKey.newChatMessageFromMember
        ? InternalNotificationType.textSmsToUser
        : InternalNotificationType.chatMessageToMember,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};
