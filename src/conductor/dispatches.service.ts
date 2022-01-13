import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dispatch, DispatchDocument, DispatchInternalUpdate, DispatchStatus } from '.';
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
    let filter: any = { dispatchId: dispatch.dispatchId };
    if (dispatch.status === DispatchStatus.canceled) {
      filter = { ...filter, status: DispatchStatus.received };
    }
    const params = filterNonNullFields<Dispatch>(dispatch);
    return this.dispatchesModel.findOneAndUpdate(
      filter,
      { $set: params },
      { upsert: false, new: true, ...this.returnResults },
    );
  }

  async get(dispatchId: string): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne({ dispatchId }, this.returnResults.projection, {
      lean: true,
    });
  }

  async find(filters: { triggeredId: string }): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne(filters, this.returnResults.projection, {
      lean: true,
    });
  }

  async delete(clientId: string) {
    const results = await this.dispatchesModel.find({ recipientClientId: clientId });

    await this.dispatchesModel.deleteMany({
      dispatchId: { $in: results.map((result) => result.dispatchId) },
    });

    return results;
  }
}
