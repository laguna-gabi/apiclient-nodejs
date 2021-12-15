import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  InternalNotificationType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectAppointmentRequestType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'appointmentId'
  | 'scheduleLink'
  | 'path'
  | 'contentKey'
>;

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
    dispatchId: generateDispatchId(contentKey, appointmentId),
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
