import {
  ContentKey,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export const generateTextMessageUserMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
}): ObjectBaseType => {
  const allowedContentKeys = new Set();
  allowedContentKeys.add(ContentKey.newChatMessageFromMember);
  allowedContentKeys.add(ContentKey.memberNotFeelingWellMessage);

  if (!allowedContentKeys.has(contentKey)) {
    throw Error(`invalid ${contentKey} - should be ${Array.from(allowedContentKeys.values())}`);
  }

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textSmsToUser,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};
