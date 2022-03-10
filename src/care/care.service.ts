import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Barrier,
  BarrierDocument,
  BarrierDomain,
  BarrierType,
  CarePlan,
  CarePlanDocument,
  CarePlanType,
  CarePlanTypeDocument,
  CarePlanTypeInput,
  CareStatus,
  CreateBarrierParams,
  CreateCarePlanParams,
  CreateRedFlagParams,
  RedFlag,
  RedFlagDocument,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '.';
import {
  BaseService,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { isNil, omitBy } from 'lodash';
import { OnEvent } from '@nestjs/event-emitter';
import { ISoftDelete } from '../db';
import { redFlags } from './redFlags';

@Injectable()
export class CareService extends BaseService {
  constructor(
    @InjectModel(RedFlag.name)
    private readonly redFlagModel: Model<RedFlagDocument> & ISoftDelete<RedFlagDocument>,
    @InjectModel(Barrier.name)
    private readonly barrierModel: Model<BarrierDocument> & ISoftDelete<BarrierDocument>,
    @InjectModel(CarePlan.name)
    private readonly carePlanModel: Model<CarePlanDocument> & ISoftDelete<CarePlanDocument>,
    @InjectModel(CarePlanType.name)
    private readonly carePlanTypeModel: Model<CarePlanTypeDocument>,
    @InjectModel(BarrierType.name)
    private readonly barrierTypeModel: Model<BarrierType>,
    readonly logger: LoggerService,
  ) {
    super();
  }

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  async createRedFlag(params: CreateRedFlagParams): Promise<RedFlag> {
    this.logger.info(params, CareService.name, this.createRedFlag.name);
    const createParams: Partial<CreateRedFlagParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(params.memberId),
      },
      isNil,
    );
    return this.redFlagModel.create(createParams);
  }

  async getMemberRedFlags(memberId: string): Promise<RedFlag[]> {
    const memberRedFlags = await this.redFlagModel.find({ memberId: new Types.ObjectId(memberId) });
    return memberRedFlags.map((redFlag) => {
      // populating red flag type from the static red flags object
      const redFlagType = redFlags.find((type) => type.id === redFlag.type);
      return { ...this.replaceId(redFlag.toObject()), type: redFlagType };
    });
  }

  async getRedFlag(id: string): Promise<RedFlag> {
    return this.redFlagModel.findById(id);
  }

  async updateRedFlag(updateRedFlagParams: UpdateRedFlagParams): Promise<RedFlag> {
    const redFlag = await this.redFlagModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateRedFlagParams.id) },
      { $set: omitBy(updateRedFlagParams, isNil) },
      { new: true },
    );
    if (!redFlag) {
      throw new Error(Errors.get(ErrorType.redFlagNotFound));
    }
    // populating red flag type from the static red flags object
    const redFlagType = redFlags.find((type) => type.id === redFlag.type);
    return { ...this.replaceId(redFlag.toObject()), type: redFlagType };
  }

  /**************************************************************************************************
   ******************************************** Barrier ********************************************
   *************************************************************************************************/

  async createBarrier(params: CreateBarrierParams): Promise<Barrier> {
    this.logger.info(params, CareService.name, this.createBarrier.name);
    const { memberId, type, redFlagId } = params;
    await this.validateBarrier(memberId, type, redFlagId);

    const createParams: Partial<CreateBarrierParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(memberId),
        redFlagId: redFlagId ? new Types.ObjectId(redFlagId) : undefined,
        type: new Types.ObjectId(type),
      },
      isNil,
    );
    return this.barrierModel.create(createParams);
  }

  private async validateBarrier(memberId: string, type: string, redFlagId: string) {
    // validate barrier type
    const result = await this.getBarrierType(type);
    if (!result) {
      throw new Error(Errors.get(ErrorType.barrierTypeNotFound));
    }

    // validate red flag
    const redFlag = await this.getRedFlag(redFlagId);
    if (!redFlag) {
      throw new Error(Errors.get(ErrorType.redFlagNotFound));
    }
    if (redFlag.memberId.toString() != memberId) {
      throw new Error(Errors.get(ErrorType.memberIdInconsistent));
    }
  }

  async updateBarrier(updateBarrierParams: UpdateBarrierParams): Promise<Barrier> {
    const { type, id, status } = updateBarrierParams;
    const updateParams: Partial<UpdateBarrierParams> = omitBy(
      {
        ...updateBarrierParams,
        type: type ? new Types.ObjectId(type) : undefined,
        completedAt: status === CareStatus.completed ? new Date(Date.now()) : undefined,
      },
      isNil,
    );
    const result = await this.barrierModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: updateParams },
      { new: true },
    );
    if (!result) {
      throw new Error(Errors.get(ErrorType.barrierNotFound));
    }
    return result;
  }

  async getMemberBarriers(memberId: string): Promise<Barrier[]> {
    return this.barrierModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .populate([{ path: 'type', strictPopulate: false }]);
  }

  async getBarrier(id: string): Promise<Barrier> {
    return this.barrierModel.findById(new Types.ObjectId(id));
  }

  async createBarrierType({
    description,
    domain,
    carePlanTypes,
  }: {
    description: string;
    domain: BarrierDomain;
    carePlanTypes: string[];
  }): Promise<BarrierType> {
    return this.barrierTypeModel.create({
      description,
      domain,
      carePlanTypes: carePlanTypes.map((carePlanType) => new Types.ObjectId(carePlanType)),
    });
  }

  async getBarrierType(id: string): Promise<BarrierType> {
    return this.barrierTypeModel
      .findById(id)
      .populate([{ path: 'carePlanTypes', strictPopulate: false }]);
  }

  async getBarrierTypes(): Promise<BarrierType[]> {
    return this.barrierTypeModel
      .find({})
      .populate([{ path: 'carePlanTypes', strictPopulate: false }]);
  }

  /**************************************************************************************************
   ******************************************** Care Plan ********************************************
   *************************************************************************************************/

  async createCarePlan(params: CreateCarePlanParams): Promise<CarePlan> {
    this.logger.info(params, CareService.name, this.createCarePlan.name);
    const { memberId, type, barrierId } = params;
    const carePlanType = await this.validateCarePlan(type, barrierId, memberId);

    const createParams: Partial<CreateCarePlanParams> = omitBy(
      {
        ...params,
        memberId: new Types.ObjectId(memberId),
        barrierId: new Types.ObjectId(barrierId),
        type: new Types.ObjectId(carePlanType),
      },
      isNil,
    );
    return this.carePlanModel.create(createParams);
  }

  private async validateCarePlan(type: CarePlanTypeInput, barrierId: string, memberId: string) {
    let carePlanType;
    if (type.custom) {
      const { id } = await this.createCarePlanType({ description: type.custom });
      carePlanType = id;
    } else {
      // validate care plan type
      const result = await this.getCarePlanType(type.id);
      if (!result) {
        throw new Error(Errors.get(ErrorType.carePlanTypeNotFound));
      }
      carePlanType = type.id;
    }

    // validate barrier
    const barrier = await this.getBarrier(barrierId);
    if (!barrier) {
      throw new Error(Errors.get(ErrorType.barrierNotFound));
    }
    if (barrier.memberId.toString() != memberId) {
      throw new Error(Errors.get(ErrorType.memberIdInconsistent));
    }
    return carePlanType;
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
    return this.carePlanModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .populate([{ path: 'type', strictPopulate: false }]);
  }

  async getCarePlan(id: string): Promise<CarePlan> {
    return this.carePlanModel.findById(id);
  }

  async createCarePlanType({
    description,
    isCustom = true,
  }: {
    description: string;
    isCustom?: boolean;
  }): Promise<CarePlanType> {
    return this.carePlanTypeModel.create({
      description,
      isCustom,
    });
  }

  async getCarePlanType(id: string): Promise<CarePlanType> {
    return this.carePlanTypeModel.findById(id);
  }

  async getCarePlanTypes(): Promise<CarePlanType[]> {
    return this.carePlanTypeModel.find({});
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberCareProcess(params: IEventDeleteMember) {
    await deleteMemberObjects<Model<RedFlagDocument> & ISoftDelete<RedFlagDocument>>(
      params,
      this.redFlagModel,
      this.logger,
      this.deleteMemberCareProcess.name,
      CareService.name,
    );
    await deleteMemberObjects<Model<BarrierDocument> & ISoftDelete<BarrierDocument>>(
      params,
      this.barrierModel,
      this.logger,
      this.deleteMemberCareProcess.name,
      CareService.name,
    );
    await deleteMemberObjects<Model<CarePlanDocument> & ISoftDelete<CarePlanDocument>>(
      params,
      this.carePlanModel,
      this.logger,
      this.deleteMemberCareProcess.name,
      CareService.name,
    );
  }
}
