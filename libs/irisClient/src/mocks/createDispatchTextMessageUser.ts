import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType, validateContentKey } from '.';
import {
  ChatInternalKey,
  ContentKey,
  InnerQueueTypes,
  LogInternalKey,
  generateDispatchId,
} from '..';

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
