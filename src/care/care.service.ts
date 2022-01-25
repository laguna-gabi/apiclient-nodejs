import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Barrier,
  BarrierDocument,
  CareStatus,
  CreateBarrierParams,
  CreateRedFlagParams,
  RedFlag,
  RedFlagDocument,
  UpdateBarrierParams,
} from '.';
import { ErrorType, Errors } from '../common';
import { isNil, omitBy } from 'lodash';

@Injectable()
export class CareService {
  constructor(
    @InjectModel(RedFlag.name)
    private readonly redFlagModel: Model<RedFlagDocument>,
    @InjectModel(Barrier.name)
    private readonly barrierModel: Model<BarrierDocument>,
  ) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  async createRedFlag(createRedFlagParams: CreateRedFlagParams): Promise<RedFlag> {
    const { memberId, createdBy } = createRedFlagParams;
    return this.redFlagModel.create({
      ...createRedFlagParams,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(createdBy),
    });
  }

  async getMemberRedFlags(memberId: string): Promise<RedFlag[]> {
    return this.redFlagModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  async getRedFlag(id: string): Promise<RedFlag> {
    return this.redFlagModel.findById(new Types.ObjectId(id));
  }
  /**************************************************************************************************
   ******************************************** Barrier ********************************************
   *************************************************************************************************/

  async createBarrier(createBarrierParams: CreateBarrierParams): Promise<Barrier> {
    const { memberId, createdBy, redFlagId } = createBarrierParams;
    return this.barrierModel.create({
      ...createBarrierParams,
      memberId: new Types.ObjectId(memberId),
      createdBy: new Types.ObjectId(createdBy),
      redFlagId: new Types.ObjectId(redFlagId),
    });
  }

  async updateBarrier(updateBarrierParams: UpdateBarrierParams): Promise<Barrier> {
    const setParams: any = omitBy(
      {
        ...updateBarrierParams,
        completedAt:
          updateBarrierParams.status === CareStatus.completed ? new Date(Date.now()) : undefined,
      },
      isNil,
    );
    const result = this.barrierModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateBarrierParams.id) },
      { $set: setParams },
      { new: true },
    );
    if (!result) {
      throw new Error(Errors.get(ErrorType.barrierNotFound));
    }
    return result;
  }

  async getMemberBarriers(memberId: string): Promise<Barrier[]> {
    return this.barrierModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  async getBarrier(id: string): Promise<Barrier> {
    return this.barrierModel.findById(new Types.ObjectId(id));
  }
}
