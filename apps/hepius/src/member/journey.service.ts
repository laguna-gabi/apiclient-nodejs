import {
  BaseService,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ISoftDelete } from '../db';
import { CreateJourneyParams, Journey, JourneyDocument, UpdateJourneyParams } from '.';
import { Identifier } from '@argus/hepiusClient';
import { OnEvent } from '@nestjs/event-emitter';
import { isEmpty, isNil, omitBy } from 'lodash';

@Injectable()
export class JourneyService extends BaseService {
  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument> & ISoftDelete<JourneyDocument>,
    readonly logger: LoggerService,
  ) {
    super();
  }

  async create(params: CreateJourneyParams): Promise<Identifier> {
    const memberIdObject = { memberId: new Types.ObjectId(params.memberId) };
    const { _id: id } = await this.journeyModel.create(memberIdObject);
    await this.journeyModel.updateMany({ ...memberIdObject, _id: { $ne: id } }, { active: false });
    return { id };
  }

  async get(journeyId: string): Promise<Journey> {
    const result = await this.journeyModel.findById(new Types.ObjectId(journeyId));
    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    return this.replaceId(result.toObject());
  }

  async getActive(memberId: string): Promise<Journey> {
    const result = await this.journeyModel.findOne({
      memberId: new Types.ObjectId(memberId),
      active: true,
    });
    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyForMemberNotFound));
    }
    return this.replaceId(result.toObject());
  }

  async getAll({ memberId }: { memberId: string }): Promise<Journey[]> {
    const results = await this.journeyModel.find({ memberId: new Types.ObjectId(memberId) });
    return results.map((result) => this.replaceId(result));
  }

  async update(updateJourneyParams: UpdateJourneyParams): Promise<Journey> {
    const setParams = omitBy(updateJourneyParams, isNil);
    const memberId = new Types.ObjectId(setParams.memberId);
    const filter = setParams.id
      ? { _id: new Types.ObjectId(setParams.id), memberId }
      : { active: true, memberId };

    delete setParams.memberId;
    delete setParams.id;

    const exisingRecord = await this.journeyModel.findOne(filter);
    if (!exisingRecord) {
      throw new Error(Errors.get(ErrorType.journeyMemberIdAndOrIdNotFound));
    }

    let result;
    if (isEmpty(setParams)) {
      result = exisingRecord;
    } else {
      result = await this.journeyModel.findOneAndUpdate(filter, { $set: setParams }, { new: true });
    }

    if (
      setParams.readmissionRisk &&
      setParams.readmissionRisk !== exisingRecord.toObject().readmissionRisk
    ) {
      result = await this.updateReadmissionRiskHistory(result._id, setParams);
    }

    return this.replaceId(result.toObject());
  }

  async updateLoggedInAt(memberId: Types.ObjectId): Promise<Journey> {
    this.logger.info({ memberId }, JourneyService.name, this.updateLoggedInAt.name);
    const date = new Date();
    await this.journeyModel.updateOne(
      { memberId, firstLoggedInAt: null },
      { $set: { firstLoggedInAt: date } },
    );
    return this.journeyModel.findOneAndUpdate(
      { memberId, active: true },
      { $set: { lastLoggedInAt: date } },
      { upsert: false, new: true },
    );
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteJourney(params: IEventDeleteMember) {
    await deleteMemberObjects<Model<JourneyDocument> & ISoftDelete<JourneyDocument>>({
      params,
      model: this.journeyModel,
      logger: this.logger,
      methodName: this.deleteJourney.name,
      serviceName: JourneyService.name,
    });
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async updateReadmissionRiskHistory(id: Types.ObjectId, setParams) {
    return this.journeyModel.findByIdAndUpdate(
      id,
      {
        $push: {
          readmissionRiskHistory: {
            readmissionRisk: setParams.readmissionRisk,
            date: new Date(),
          },
        },
      },
      { new: true },
    );
  }
}
