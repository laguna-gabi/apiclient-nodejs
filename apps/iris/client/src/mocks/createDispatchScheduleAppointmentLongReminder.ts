import { NotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';
import { AppointmentInternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';

export type ObjectAppointmentScheduleLongReminderType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentTime' | 'triggersAt'>;

export class ObjectAppointmentScheduleLongReminderClass {
  constructor(
    readonly objectAppointmentScheduleLongReminderType: ObjectAppointmentScheduleLongReminderType,
  ) {}
}

export const generateAppointmentScheduleLongReminderMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  appointmentTime,
  triggersAt,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  appointmentTime: Date;
  triggersAt: Date;
  correlationId?: string;
}): ObjectAppointmentScheduleLongReminderType => {
  const contentKey = AppointmentInternalKey.appointmentLongReminder;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    appointmentTime,
    triggersAt,
    contentKey,
  };
};
