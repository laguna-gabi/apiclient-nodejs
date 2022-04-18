import { NotificationType, ServiceName } from '@argus/pandora';
import { AppointmentInternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

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
  const contentKey = AppointmentInternalKey.appointmentRequest;
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
