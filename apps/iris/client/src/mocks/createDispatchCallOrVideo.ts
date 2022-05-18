import { NotificationType, ServiceName } from '@argus/pandora';
import { ICreateDispatch, InnerQueueTypes, NotifyCustomKey, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType } from '.';

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
  const contentKey = NotifyCustomKey.callOrVideo;
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
