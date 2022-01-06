import {
  ICreateDispatch,
  InnerQueueTypes,
  InternalKey,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentRequestType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentId' | 'scheduleLink' | 'path'>;

export class ObjectAppointmentRequestClass {
  constructor(readonly objectAppointmentRequestMock: ObjectAppointmentRequestType) {}
}

export const generateRequestAppointmentMock = ({
  recipientClientId,
  senderClientId,
  appointmentId,
  scheduleLink,
  correlationId = v4(),
}: {
  recipientClientId: string;
  senderClientId: string;
  appointmentId: string;
  scheduleLink: string;
  correlationId?: string;
}): ObjectAppointmentRequestType => {
  const contentKey = InternalKey.appointmentRequest;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, appointmentId, recipientClientId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    appointmentId,
    scheduleLink,
    contentKey,
    path: `connect/${appointmentId}`,
  };
};
