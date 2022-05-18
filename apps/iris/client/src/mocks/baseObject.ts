import { ICreateDispatch } from '..';

export type ObjectBaseType = Pick<
  ICreateDispatch,
  | 'type'
  | 'dispatchId'
  | 'correlationId'
  | 'serviceName'
  | 'notificationType'
  | 'recipientClientId'
  | 'senderClientId'
  | 'contentKey'
>;

export class ObjectBaseClass {
  constructor(readonly objectBaseType: ObjectBaseType) {}
}
