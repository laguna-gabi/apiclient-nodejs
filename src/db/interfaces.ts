import { Types } from 'mongoose';

export class ISoftDelete<T> {
  findWithDeleted: (args) => Promise<T[]>;
  findOneWithDeleted: (args) => Promise<T>;
  delete: (clientId: Types.ObjectId) => Promise<T>;
}
export interface Audit {
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}
