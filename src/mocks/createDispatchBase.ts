import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectBaseType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'contentKey'
>;

export class ObjectBaseClass {
  constructor(readonly objectBaseType: ObjectBaseType) {}
}

export const generateBaseMock = ({
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
  allowedContentKeys.add(ContentKey.newChatMessageFromUser);
  allowedContentKeys.add(ContentKey.memberNotFeelingWellMessage);

  if (!allowedContentKeys.has(contentKey)) {
    throw Error(`invalid ${contentKey} - should be ${Object.keys(allowedContentKeys)}`);
  }

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType:
      contentKey === ContentKey.newChatMessageFromUser
        ? InternalNotificationType.chatMessageToMember
        : InternalNotificationType.textSmsToUser,
    recipientClientId,
    senderClientId,
    contentKey,
  };
};
