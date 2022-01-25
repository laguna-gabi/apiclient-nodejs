import { ICreateDispatch } from '@lagunahealth/pandora';

export interface Dispatch extends ICreateDispatch {
  sentAt?: Date;
}
