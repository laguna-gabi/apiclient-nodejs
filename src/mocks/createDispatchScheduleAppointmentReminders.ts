import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalKey,
  InternalNotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentScheduleReminderType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentTime' | 'triggersAt'>;

export class ObjectAppointmentScheduleReminderClass {
  constructor(
    readonly objectAppointmentScheduleReminderMock: ObjectAppointmentScheduleReminderType,
  ) {}
}

export const generateAppointmentScheduleReminderMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  appointmentTime,
  triggersAt,
  correlationId = v4(),
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  appointmentTime: Date;
  triggersAt: Date;
  correlationId?: string;
  contentKey: ContentKey;
}): ObjectAppointmentScheduleReminderType => {
  if (
    contentKey !== InternalKey.appointmentReminder &&
    contentKey !== InternalKey.appointmentLongReminder
  ) {
    throw Error(
      `invalid ${contentKey} - should be ${InternalKey.appointmentReminder} ` +
        `or ${InternalKey.appointmentLongReminder}`,
    );
  }
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
