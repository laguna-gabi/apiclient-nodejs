import {
  ICreateDispatch,
  InnerQueueTypes,
  InternalKey,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentScheduledType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentTime'>;

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
  const contentKey = InternalKey.appointmentScheduledUser;
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
  const contentKey = InternalKey.appointmentScheduledMember;
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
