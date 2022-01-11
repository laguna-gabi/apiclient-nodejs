import {
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateNotificationTypeText,
} from '../';
import { v4 } from 'uuid';

export type ObjectFutureNotifyTypeWithSendbirdType = ObjectBaseType &
  Pick<ICreateDispatch, 'notificationType' | 'triggersAt' | 'sendBirdChannelUrl' | 'content'>;

export class ObjectFutureNotifyTypeWithSendbirdClass {
  constructor(
    readonly objectFutureNotifyTypeWithSendbirdType: ObjectFutureNotifyTypeWithSendbirdType,
  ) {}
}

export const generateObjectFutureNotifyTypeWithSendbirdMock = ({
  recipientClientId,
  senderClientId,
  notificationType,
  triggersAt,
  sendBirdChannelUrl,
  content,
}: {
  recipientClientId: string;
  senderClientId: string;
  notificationType: NotificationType;
  triggersAt: Date;
  sendBirdChannelUrl: string;
  content: string;
}): ObjectFutureNotifyTypeWithSendbirdType => {
  validateNotificationTypeText(notificationType);
  const contentKey = CustomKey.customContent;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    senderClientId,
    triggersAt,
    contentKey,
    sendBirdChannelUrl,
    content,
  };
};
