import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Barrier,
  BarrierDocument,
  CarePlan,
  CarePlanDocument,
  CareStatus,
  CreateBarrierParams,
  CreateCarePlanParams,
  CreateRedFlagParams,
  RedFlag,
  RedFlagDocument,
  UpdateBarrierParams,
  UpdateCarePlanParams,
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
    @InjectModel(CarePlan.name)
    private readonly carePlanModel: Model<CarePlanDocument>,
  ) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  async createRedFlag(params: CreateRedFlagParams): Promise<RedFlag> {
    const createParams: Partial<CreateRedFlagParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(params.memberId),
        createdBy: new Types.ObjectId(params.createdBy),
      },
      isNil,
    );
    return this.redFlagModel.create(createParams);
  }

  async getMemberRedFlags(memberId: string): Promise<RedFlag[]> {
    return this.redFlagModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  async getRedFlag(id: string): Promise<RedFlag> {
    return this.redFlagModel.findById(id);
  }

  async deleteRedFlag(id: string, deletedBy: string): Promise<boolean> {
    const result = await this.redFlagModel.findById(new Types.ObjectId(id));
    if (!result) {
      throw new Error(Errors.get(ErrorType.redFlagNotFound));
    }
    await result.delete(new Types.ObjectId(deletedBy));

    // remove reference to the deleted redFlag from related barriers
    await this.barrierModel.updateMany(
      { redFlagId: new Types.ObjectId(id) },
      { $unset: { redFlagId: '' } },
    );

    return true;
  }

  /**************************************************************************************************
   ******************************************** Barrier ********************************************
   *************************************************************************************************/

  async createBarrier(params: CreateBarrierParams): Promise<Barrier> {
    const createParams: Partial<CreateBarrierParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(params.memberId),
        createdBy: new Types.ObjectId(params.createdBy),
        redFlagId: params.redFlagId ? new Types.ObjectId(params.redFlagId) : undefined,
      },
      isNil,
    );
    return this.barrierModel.create(createParams);
  }

  async updateBarrier(updateBarrierParams: UpdateBarrierParams): Promise<Barrier> {
    const updateParams: Partial<UpdateBarrierParams> = omitBy(
      {
        ...updateBarrierParams,
        completedAt:
          updateBarrierParams.status === CareStatus.completed ? new Date(Date.now()) : undefined,
      },
      isNil,
    );
    const result = this.barrierModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateBarrierParams.id) },
      { $set: updateParams },
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

  /**************************************************************************************************
   ******************************************** Care Plan ********************************************
   *************************************************************************************************/

  async createCarePlan(params: CreateCarePlanParams): Promise<CarePlan> {
    const createParams: Partial<CreateCarePlanParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(params.memberId),
        createdBy: new Types.ObjectId(params.createdBy),
        barrierId: params.barrierId ? new Types.ObjectId(params.barrierId) : undefined,
      },
      isNil,
    );
    return this.carePlanModel.create(createParams);
  }

  async updateCarePlan(updateCarePlanParams: UpdateCarePlanParams): Promise<CarePlan> {
    const updateParams: Partial<UpdateCarePlanParams> = omitBy(
      {
        ...updateCarePlanParams,
        completedAt:
          updateCarePlanParams.status === CareStatus.completed ? new Date(Date.now()) : undefined,
      },
      isNil,
    );
    const result = this.carePlanModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateCarePlanParams.id) },
      { $set: updateParams },
      { new: true },
    );
    if (!result) {
      throw new Error(Errors.get(ErrorType.carePlanNotFound));
    }
    return result;
  }

  async getMemberCarePlans(memberId: string): Promise<CarePlan[]> {
    return this.carePlanModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  async getCarePlan(id: string): Promise<CarePlan> {
    return this.carePlanModel.findById(new Types.ObjectId(id));
  }
}
