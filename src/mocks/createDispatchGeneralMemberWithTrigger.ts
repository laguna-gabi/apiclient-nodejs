import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
  validateNotificationTypeText,
} from '../';
import { v4 } from 'uuid';

export type ObjectGeneralMemberTriggeredType = ObjectBaseType &
  Pick<ICreateDispatch, 'notificationType' | 'triggersAt'>;

export class ObjectGeneralMemberTriggeredClass {
  constructor(readonly objectGeneralMemberTriggeredMock: ObjectGeneralMemberTriggeredType) {}
}

export const generateGeneralMemberTriggeredMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
  notificationType,
  triggersAt,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
  notificationType: NotificationType;
  triggersAt: Date;
}): ObjectGeneralMemberTriggeredType => {
  validateNotificationTypeText(notificationType);
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
  };
};
