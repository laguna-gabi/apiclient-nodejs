import { NotificationType, ServiceName } from '@argus/pandora';
import { ExternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

export type ObjectExternalContentWebScheduleAppointmentType = ObjectBaseType &
  Pick<ICreateDispatch, 'scheduleLink'>;

export class ObjectExternalContentWebScheduleAppointmentClass {
  constructor(
    // eslint-disable-next-line max-len
    readonly objectExternalContentWebScheduleAppointmentType: ObjectExternalContentWebScheduleAppointmentType,
  ) {}
}

export const generateExternalContentWebScheduleAppointmentMock = ({
  recipientClientId,
  senderClientId,
  scheduleLink,
}: {
  recipientClientId: string;
  senderClientId: string;
  scheduleLink: string;
}): ObjectExternalContentWebScheduleAppointmentType => {
  const contentKey = ExternalKey.scheduleAppointment;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    contentKey,
    scheduleLink,
  };
};
