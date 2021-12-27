import {
  ExternalKey,
  ICreateDispatch,
  InnerQueueTypes,
  NotificationType,
  ObjectBaseType,
  ServiceName,
  generateDispatchId,
} from '../index';
import { v4 } from 'uuid';

export type ObjectExternalContentType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

export class ObjectExternalContentClass {
  constructor(readonly objectExternalContentType: ObjectExternalContentType) {}
}

export const generateExternalContentMock = ({
  recipientClientId,
  senderClientId,
  path,
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  path: string;
  contentKey: ExternalKey;
}): ObjectExternalContentType => {
  return {
    type: InnerQueueTypes.createDispatch,
    dispatchId: generateDispatchId(contentKey, recipientClientId, Date.now().toString()),
    correlationId: v4(),
    serviceName: ServiceName.hepius,
    notificationType: NotificationType.text,
    recipientClientId,
    senderClientId,
    contentKey,
    path,
  };
};
