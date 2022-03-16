import { ICreateDispatch } from '../index';

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
