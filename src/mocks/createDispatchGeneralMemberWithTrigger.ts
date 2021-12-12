import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
  generateDispatchId,
} from '../';
import { v4 } from 'uuid';

export type ObjectGeneralMemberTriggeredType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'triggeredAt'
  | 'contentKey'
>;

export class ObjectGeneralMemberTriggeredClass {
  constructor(readonly objectGeneralMemberTriggeredMock: ObjectGeneralMemberTriggeredType) {}
}

export const generateGeneralMemberTriggeredMock = ({
  recipientClientId,
  senderClientId,
  contentKey,
  triggeredAt,
}: {
  recipientClientId: string;
  senderClientId: string;
  contentKey: ContentKey;
  triggeredAt: Date;
}): ObjectGeneralMemberTriggeredType => {
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textToMember,
    recipientClientId,
    senderClientId,
    triggeredAt,
    contentKey,
  };
};
