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

export type ObjectRegisterMemberWithTriggeredType = ObjectBaseType &
  Pick<ICreateDispatch, 'notificationType' | 'triggersAt'>;

export class ObjectRegisterMemberWithTriggeredClass {
  constructor(
    readonly objectRegisterMemberWithTriggeredType: ObjectRegisterMemberWithTriggeredType,
  ) {}
}

export const generateObjectRegisterMemberWithTriggeredMock = ({
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
}): ObjectRegisterMemberWithTriggeredType => {
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
