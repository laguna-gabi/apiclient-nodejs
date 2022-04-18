import { CancelNotificationType, ServiceName } from '@argus/pandora';
import { v4 } from 'uuid';
import { ICreateDispatch, InnerQueueTypes, NotifyCustomKey, generateDispatchId } from '..';

export type ObjectCancelType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'contentKey'
  | 'peerId'
>;

export class ObjectCancelClass {
  constructor(readonly objectCancelType: ObjectCancelType) {}
}

export const generateObjectCancelMock = ({
  recipientClientId,
  notificationType,
  peerId,
}: {
  recipientClientId: string;
  notificationType: CancelNotificationType;
  peerId: string;
}): ObjectCancelType => {
  const contentKey = NotifyCustomKey.cancelNotify;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    peerId,
    contentKey,
  };
};
