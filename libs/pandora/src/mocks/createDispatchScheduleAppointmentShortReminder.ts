import {
  AppointmentInternalKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentScheduleReminderType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentTime' | 'triggersAt' | 'chatLink'>;

export class ObjectAppointmentScheduleReminderClass {
  constructor(
    readonly objectAppointmentScheduleReminderType: ObjectAppointmentScheduleReminderType,
  ) {}
}

export const generateAppointmentScheduleReminderMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  appointmentTime,
  triggersAt,
  correlationId = v4(),
  chatLink,
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  appointmentTime: Date;
  triggersAt: Date;
  chatLink: string;
  correlationId?: string;
}): ObjectAppointmentScheduleReminderType => {
  const contentKey = AppointmentInternalKey.appointmentReminder;
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
    chatLink,
  };
};
