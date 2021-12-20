import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../';
import { v4 } from 'uuid';

export type ObjectGeneralMemberTriggeredType = ObjectBaseType & Pick<ICreateDispatch, 'triggersAt'>;

export class ObjectGeneralMemberTriggeredClass {
  constructor(readonly objectGeneralMemberTriggeredMock: ObjectGeneralMemberTriggeredType) {}
}

export const generateGeneralMemberTriggeredMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
  triggersAt,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
  triggersAt: Date;
}): ObjectGeneralMemberTriggeredType => {
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textToMember,
    recipientClientId,
    senderClientId,
    triggersAt,
    contentKey,
  };
};
