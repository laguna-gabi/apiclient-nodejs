import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dispatch, DispatchDocument, DispatchInternalUpdate, DispatchStatus } from '.';
import { filterNonNullFields } from '../common';

export interface FindFilter {
  senderClientId?: string;
  status?: DispatchStatus;
}

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
    let filter: { dispatchId: string; status?: DispatchStatus } = {
      dispatchId: dispatch.dispatchId,
    };
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

  async bulkUpdateFutureDispatches({
    recipientClientId,
    senderClientId,
  }: {
    recipientClientId: string;
    senderClientId: string;
  }): Promise<void> {
    await this.dispatchesModel.updateMany(
      {
        recipientClientId,
        status: DispatchStatus.received,
        senderClientId: { $ne: null },
        triggersAt: { $gte: new Date() },
      },
      { $set: { senderClientId } },
    );
  }

  async get(dispatchId: string): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne({ dispatchId }, this.returnResults.projection, {
      lean: true,
    });
  }

  async findOne(filters: { triggeredId: string }): Promise<Dispatch | null> {
    return this.dispatchesModel.findOne(filters, this.returnResults.projection, {
      lean: true,
    });
  }

  async find(filter: FindFilter, projection?: string[]): Promise<Dispatch[] | null> {
    const project = projection && {};
    projection?.forEach((field) => (project[field.trim()] = 1));
    return this.dispatchesModel.find(filter, { ...project, ...{ _id: 0 } }, { lean: true });
  }

  async delete(clientId: string) {
    const results = await this.dispatchesModel.find({ recipientClientId: clientId });
    return Promise.all(
      results.map(async (result) => {
        result.status =
          [DispatchStatus.done, DispatchStatus.error].indexOf(result.status) >= 0
            ? result.status
            : DispatchStatus.canceled;
        await result.delete();
        return result;
      }),
    );
  }
}
