import {
  ChatInternalKey,
  ContentKey,
  InnerQueueTypes,
  LogInternalKey,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateContentKey,
} from '../index';
import { v4 } from 'uuid';

const allowedContentKeys = new Set<ContentKey>();
allowedContentKeys.add(ChatInternalKey.newChatMessageFromMember);
allowedContentKeys.add(LogInternalKey.memberNotFeelingWellMessage);

export const generateTextMessageUserMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
}): ObjectBaseType => {
  validateContentKey(allowedContentKeys, contentKey);

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};
