import {
  CancelNotificationType,
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  ServiceName,
  generateDispatchId,
} from '../';
import { v4 } from 'uuid';

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
  | 'notificationId'
>;

export class ObjectCancelClass {
  constructor(readonly objectCancelType: ObjectCancelType) {}
}

export const generateObjectCancelMock = ({
  recipientClientId,
  notificationType,
  peerId,
  notificationId,
}: {
  recipientClientId: string;
  notificationType: CancelNotificationType;
  peerId: string;
  notificationId: string;
}): ObjectCancelType => {
  const contentKey = CustomKey.cancelNotify;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    peerId,
    contentKey,
    notificationId,
  };
};
