import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectNewMemberType = ObjectBaseType & Pick<ICreateDispatch, 'appointmentId'>;

export class ObjectNewMemberClass {
  constructor(readonly objectNewMemberMock: ObjectNewMemberType) {}
}

export const generateNewMemberMock = ({
  recipientClientId,
  senderClientId,
}: {
  recipientClientId: string;
  senderClientId: string;
}): ObjectNewMemberType => {
  const contentKey = ContentKey.newMember;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textSmsToMember,
    recipientClientId,
    senderClientId,
    appointmentId: v4(),
    contentKey,
  };
};
