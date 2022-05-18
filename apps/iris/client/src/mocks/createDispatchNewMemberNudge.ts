import { NotificationType, ServiceName } from '@argus/pandora';
import { ICreateDispatch, InnerQueueTypes, RegisterInternalKey, generateDispatchId } from '../';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

export type ObjectNewMemberNudgeType = ObjectBaseType &
  Pick<ICreateDispatch, 'appointmentId' | 'triggersAt'>;

export class ObjectNewMemberNudgeClass {
  constructor(readonly objectNewMemberNudgeMock: ObjectNewMemberNudgeType) {}
}

export const generateNewMemberNudgeMock = ({
  recipientClientId,
  senderClientId,
}: {
  recipientClientId: string;
  senderClientId: string;
}): ObjectNewMemberNudgeType => {
  const contentKey = RegisterInternalKey.newMemberNudge;
  const triggersAt = new Date();
  triggersAt.setHours(triggersAt.getHours() + 48);

  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.textSms,
    recipientClientId,
    senderClientId,
    appointmentId: v4(),
    triggersAt,
    contentKey,
  };
};
