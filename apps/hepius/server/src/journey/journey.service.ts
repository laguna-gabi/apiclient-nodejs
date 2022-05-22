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
import {
  CreateJourneyParams,
  GraduateMemberParams,
  Journey,
  JourneyDocument,
  SetGeneralNotesParams,
  UpdateJourneyParams,
} from '.';
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
    return { id };
  }

  async get(journeyId: string): Promise<Journey> {
    const result = await this.journeyModel.findById(new Types.ObjectId(journeyId));
    if (!result) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    return this.replaceId(result.toObject());
  }

  async getRecent(memberId: string): Promise<Journey> {
    const [result] = await this.journeyModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ _id: -1 })
      .limit(1)
      .lean();
    if (!result) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return this.replaceId(result);
  }

  async getAll({ memberId }: { memberId: string }): Promise<Journey[]> {
    const results = await this.journeyModel
      .find({ memberId: new Types.ObjectId(memberId) })
      .sort({ _id: -1 });
    return results.map((result) => this.replaceId(result));
  }

  async update(updateJourneyParams: UpdateJourneyParams): Promise<Journey> {
    const setParams = omitBy(updateJourneyParams, isNil);
    delete setParams.memberId;

    const exisingRecord = await this.getRecent(updateJourneyParams.memberId);
    if (!exisingRecord) {
      throw new Error(Errors.get(ErrorType.journeyNotFound));
    }

    if (isEmpty(setParams)) {
      return this.replaceId(exisingRecord);
    } else {
      let result = await this.journeyModel.findByIdAndUpdate(
        exisingRecord.id,
        { $set: setParams },
        { new: true },
      );
      if (
        setParams.readmissionRisk &&
        setParams.readmissionRisk !== exisingRecord.readmissionRisk
      ) {
        result = await this.updateReadmissionRiskHistory(
          new Types.ObjectId(exisingRecord.id),
          setParams,
        );
      }
      return this.replaceId(result.toObject());
    }
  }

  async updateLoggedInAt(memberId: Types.ObjectId): Promise<Journey> {
    this.logger.info({ memberId }, JourneyService.name, this.updateLoggedInAt.name);
    const date = new Date();
    const recent = await this.getRecent(memberId.toString());
    await this.journeyModel.updateOne(
      { _id: new Types.ObjectId(recent.id), firstLoggedInAt: null },
      { $set: { firstLoggedInAt: date } },
      { new: true },
    );
    return this.journeyModel.findByIdAndUpdate(
      recent.id,
      { $set: { lastLoggedInAt: date } },
      { upsert: false, new: true },
    );
  }

  async graduate(graduateParams: GraduateMemberParams) {
    const recent = await this.getRecent(graduateParams.id);
    await this.journeyModel.findByIdAndUpdate(recent.id, {
      $set: {
        isGraduated: graduateParams.isGraduated,
        graduationDate: graduateParams.isGraduated ? Date.now() : null,
      },
    });
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
   ****************************************** General notes ****************************************
   ************************************************************************************************/
  async setGeneralNotes(setGeneralNotesParams: SetGeneralNotesParams): Promise<void> {
    const setParams = omitBy(
      {
        generalNotes: setGeneralNotesParams.note,
        nurseNotes: setGeneralNotesParams.nurseNotes,
      },
      isNil,
    );
    const recent = await this.getRecent(setGeneralNotesParams.memberId);
    await this.journeyModel.findByIdAndUpdate(recent.id, { $set: setParams });
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
