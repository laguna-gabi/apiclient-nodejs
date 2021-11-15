import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dispatch, DispatchDocument } from '.';
import { filterNonNullFields } from '../common';

@Injectable()
export class DispatchesService {
  constructor(
    @InjectModel(Dispatch.name) private readonly dispatchesModel: Model<DispatchDocument>,
  ) {}

  async update(dispatch: Dispatch): Promise<Dispatch> {
    const params = filterNonNullFields<Dispatch>(dispatch);

    return this.dispatchesModel.findOneAndUpdate(
      { dispatchId: params.dispatchId },
      { $set: params },
      { upsert: true, new: true },
    );
  }

  async get(dispatchId: string): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne({ dispatchId });
  }
}
