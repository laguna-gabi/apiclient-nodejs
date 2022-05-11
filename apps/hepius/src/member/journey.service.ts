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
import { Journey, JourneyDocument } from '.';
import { Identifier } from '@argus/hepiusClient';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class JourneyService extends BaseService {
  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument> & ISoftDelete<JourneyDocument>,
    readonly logger: LoggerService,
  ) {
    super();
  }

  // the params to this method will be set on many journey tickets, for example:
  // https://app.shortcut.com/laguna-health/story/4951/move-member-fields-to-journey
  async create({ memberId }: { memberId: string }): Promise<Identifier> {
    const memberIdObject = { memberId: new Types.ObjectId(memberId) };
    const { _id: id } = await this.journeyModel.create(memberIdObject);
    await this.journeyModel.updateMany(
      { ...memberIdObject, _id: { $ne: id } },
      { isActive: false },
    );
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
      isActive: true,
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

  async updateLoggedInAt(memberId: Types.ObjectId): Promise<Journey> {
    this.logger.info({ memberId }, JourneyService.name, this.updateLoggedInAt.name);
    const date = new Date();
    await this.journeyModel.updateOne(
      { memberId, firstLoggedInAt: null },
      { $set: { firstLoggedInAt: date } },
    );
    return this.journeyModel.findOneAndUpdate(
      { memberId, isActive: true },
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
}
