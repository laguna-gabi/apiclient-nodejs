import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentScheduledType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'appointmentTime'
  | 'contentKey'
>;

export class ObjectAppointmentScheduledClass {
  constructor(readonly objectAppointmentScheduledType: ObjectAppointmentScheduledType) {}
}

export const generateAppointmentScheduledUserMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  appointmentTime,
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  appointmentTime: Date;
}): ObjectAppointmentScheduledType => {
  const contentKey = ContentKey.appointmentScheduledUser;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textSmsToUser,
    recipientClientId,
    senderClientId,
    appointmentTime,
    contentKey,
  };
};

export const generateAppointmentScheduledMemberMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  appointmentTime,
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  appointmentTime: Date;
}): ObjectAppointmentScheduledType => {
  const contentKey = ContentKey.appointmentScheduledMember;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textSmsToMember,
    recipientClientId,
    senderClientId,
    appointmentTime,
    contentKey,
  };
};
