import { Types } from 'mongoose';

export const useFactoryOptions = {
  overrideMethods: true,
  deleted: true,
  deletedType: Boolean,
  deletedAt: true,
  deletedAtType: Date,
  deletedBy: true,
  deletedByType: Types.ObjectId,
};
