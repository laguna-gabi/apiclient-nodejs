import { IUpdateSenderClientId, InnerQueueTypes } from '..';
import { v4 } from 'uuid';

export type UpdateSenderClientIdType = IUpdateSenderClientId;

export class ObjectUpdateSenderClientIdClass {
  constructor(readonly updateSenderClientIdType: UpdateSenderClientIdType) {}
}

export const generateUpdateSenderClientIdMock = ({
  recipientClientId,
  senderClientId,
}: {
  recipientClientId: string;
  senderClientId: string;
}): UpdateSenderClientIdType => {
  return {
    type: InnerQueueTypes.updateSenderClientId,
    correlationId: v4(),
    recipientClientId,
    senderClientId,
  };
};
