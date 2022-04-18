import { NotificationType, ServiceName } from '@argus/pandora';
import { ContentKey, ExternalKey, ICreateDispatch, InnerQueueTypes, generateDispatchId } from '..';
import { v4 } from 'uuid';
import { ObjectBaseType, validateContentKey } from '.';

const allowedContentKeys = new Set<ContentKey>();
allowedContentKeys.add(ExternalKey.addCaregiverDetails);
allowedContentKeys.add(ExternalKey.setCallPermissions);

export type ObjectExternalContentMobileType = ObjectBaseType & Pick<ICreateDispatch, 'path'>;

export class ObjectExternalContentMobileClass {
  constructor(readonly objectExternalContentMobileType: ObjectExternalContentMobileType) {}
}

export const generateExternalContentMobileMock = ({
  recipientClientId,
  senderClientId,
  path,
  contentKey,
}: {
  recipientClientId: string;
  senderClientId: string;
  path: string;
  contentKey: ExternalKey;
}): ObjectExternalContentMobileType => {
  validateContentKey(allowedContentKeys, contentKey);

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
