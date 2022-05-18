import { Types } from 'mongoose';

export class ISoftDelete<T> {
  findWithDeleted: (args) => Promise<T[]>;
  delete: (clientId: Types.ObjectId) => Promise<T>;
}
