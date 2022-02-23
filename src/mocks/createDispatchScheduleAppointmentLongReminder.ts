import { v4 } from 'uuid';
import {
  AppointmentInternalKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';

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
