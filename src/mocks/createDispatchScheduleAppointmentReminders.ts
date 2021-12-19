import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentScheduleReminderType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'appointmentTime'
  | 'triggersAt'
  | 'contentKey'
>;

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
    contentKey !== ContentKey.appointmentReminder &&
    contentKey !== ContentKey.appointmentLongReminder
  ) {
    throw Error(
      `invalid ${contentKey} - should be ${ContentKey.appointmentReminder} ` +
        `or ${ContentKey.appointmentLongReminder}`,
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
