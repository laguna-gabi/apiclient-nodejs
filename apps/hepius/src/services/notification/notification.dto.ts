import { ICreateDispatch } from '@argus/pandora';

export interface Dispatch extends ICreateDispatch {
  sentAt?: Date;
}
