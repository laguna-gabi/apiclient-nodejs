import {
  CustomKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../';
import { v4 } from 'uuid';

export type ObjectCallOrVideoType = ObjectBaseType &
  Pick<ICreateDispatch, 'peerId' | 'path' | 'sendBirdChannelUrl'>;

export class ObjectCallOrVideoClass {
  constructor(readonly objectCallOrVideoType: ObjectCallOrVideoType) {}
}

export const generateObjectCallOrVideoMock = ({
  recipientClientId,
  senderClientId,
  notificationType,
  peerId,
  path,
  sendBirdChannelUrl,
}: {
  recipientClientId: string;
  senderClientId: string;
  notificationType: NotificationType;
  peerId: string;
  path: string;
  sendBirdChannelUrl: string;
}): ObjectCallOrVideoType => {
  if (notificationType !== NotificationType.call && notificationType !== NotificationType.video) {
    throw Error(
      `invalid notificationType - ${notificationType} - should be ${
        (NotificationType.call, NotificationType.video)
      }`,
    );
  }
  const contentKey = CustomKey.callOrVideo;
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
    path,
    sendBirdChannelUrl,
  };
};
