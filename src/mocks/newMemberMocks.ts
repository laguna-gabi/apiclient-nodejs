import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
} from '../index';
import { v4 } from 'uuid';

export type ObjectNewMemberType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'appointmentId'
  | 'contentKey'
>;

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
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: v4(),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textSmsToMember,
    recipientClientId,
    senderClientId,
    appointmentId: v4(),
    contentKey: ContentKey.newMember,
  };
};
