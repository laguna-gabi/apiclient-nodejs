import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dispatch, DispatchDocument, DispatchInternalUpdate } from '.';
import { filterNonNullFields } from '../common';

@Injectable()
export class DispatchesService {
  private readonly returnResults = {
    projection: { _id: 0, updatedAt: 0, createdAt: 0 },
    lean: true,
  };

  constructor(
    @InjectModel(Dispatch.name) private readonly dispatchesModel: Model<DispatchDocument>,
  ) {}

  async update(dispatch: Dispatch): Promise<Dispatch> {
    const params = filterNonNullFields<Dispatch>(dispatch);

    return this.dispatchesModel.findOneAndUpdate(
      { dispatchId: params.dispatchId },
      { $set: params },
      { upsert: true, new: true, ...this.returnResults },
    );
  }

  async internalUpdate(dispatch: DispatchInternalUpdate): Promise<Dispatch | null> {
    if (!dispatch.dispatchId) {
      return;
    }
    const params = filterNonNullFields<Dispatch>(dispatch);

    return this.dispatchesModel.findOneAndUpdate(
      { dispatchId: dispatch.dispatchId },
      { $set: params },
      { upsert: false, new: true, ...this.returnResults },
    );
  }

  async get(dispatchId: string): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne({ dispatchId }, this.returnResults.projection, {
      lean: true,
    });
  }
}
