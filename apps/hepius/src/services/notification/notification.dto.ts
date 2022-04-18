import { ICreateDispatch } from '@argus/irisClient';

export interface Dispatch extends ICreateDispatch {
  sentAt?: Date;
}
