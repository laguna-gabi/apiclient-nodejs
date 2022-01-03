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
  const contentKey = InternalKey.appointmentLongReminder;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, appointmentId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textToMember,
    recipientClientId,
    senderClientId,
    appointmentTime,
    triggersAt,
    contentKey,
  };
};
