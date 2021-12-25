import {
  ContentKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../';
import { v4 } from 'uuid';

export type ObjectCallOrVideoType = ObjectBaseType & Pick<ICreateDispatch, 'peerId'>;

export class ObjectCallOrVideoClass {
  constructor(readonly objectCallOrVideoType: ObjectCallOrVideoType) {}
}

export const generateObjectCallOrVideoMock = ({
  recipientClientId,
  senderClientId,
  notificationType,
  peerId,
}: {
  recipientClientId: string;
  senderClientId: string;
  notificationType: NotificationType;
  peerId: string;
}): ObjectCallOrVideoType => {
  if (notificationType !== NotificationType.call && notificationType !== NotificationType.video) {
    throw Error(
      `invalid notificationType - ${notificationType} - should be ${
        (NotificationType.call, NotificationType.video)
      }`,
    );
  }
  const contentKey = ContentKey.callOrVideo;
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType,
    recipientClientId,
    senderClientId,
    peerId,
    contentKey,
  };
};
