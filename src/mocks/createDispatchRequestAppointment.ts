import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
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
  const contentKey = ContentKey.appointmentRequest;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, appointmentId, recipientClientId),
    correlationId,
    serviceName: ServiceName.hepius,
    notificationType: InternalNotificationType.textToMember,
    recipientClientId,
    senderClientId,
    appointmentId,
    scheduleLink,
    contentKey,
    path: `connect/${appointmentId}`,
  };
};
