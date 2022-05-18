import { NotificationType, ServiceName } from '@argus/pandora';
import { ICreateDispatch, InnerQueueTypes, RegisterInternalKey, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

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
  const contentKey = RegisterInternalKey.newMember;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    appointmentId: v4(),
    contentKey,
  };
};

export const generateNewControlMemberMock = ({
  recipientClientId,
}: {
  recipientClientId: string;
}): ObjectBaseType => {
  const contentKey = RegisterInternalKey.newControlMember;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    contentKey,
  };
};
