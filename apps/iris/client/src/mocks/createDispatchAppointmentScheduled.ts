import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';
import { AppointmentInternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';

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
  const contentKey = AppointmentInternalKey.appointmentScheduledUser;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
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
  const contentKey = AppointmentInternalKey.appointmentScheduledMember;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    appointmentTime,
    contentKey,
  };
};
