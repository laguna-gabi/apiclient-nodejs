import {
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

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
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(
      CustomKey.customContent,
      recipientClientId,
      Date.now().toString(),
    ),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.chatMessageToUser,
    recipientClientId,
    senderClientId,
    content,
    contentKey: CustomKey.customContent,
    sendBirdChannelUrl,
  };
};
