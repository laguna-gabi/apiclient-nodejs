import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BaseService,
  EventType,
  IEventDeleteMember,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';
import { AddCaregiverParams, CaregiverDocument, UpdateCaregiverParams } from '.';
import { Caregiver } from '@argus/hepiusClient';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class CaregiverService extends BaseService {
  constructor(
    @InjectModel(Caregiver.name)
    private readonly caregiverModel: Model<CaregiverDocument> & ISoftDelete<CaregiverDocument>,
    readonly logger: LoggerService,
  ) {
    super();
  }

  async addCaregiver(addCaregiverParams: AddCaregiverParams): Promise<Caregiver> {
    return this.caregiverModel.create({
      ...addCaregiverParams,
      memberId: new Types.ObjectId(addCaregiverParams.memberId),
      journeyId: new Types.ObjectId(addCaregiverParams.journeyId),
    });
  }

  async deleteCaregiver(id: string, deletedBy: string, hard?: boolean) {
    if (hard) {
      return this.caregiverModel.remove({ _id: new Types.ObjectId(id) });
    } else {
      const caregiver = await this.caregiverModel.findOne({
        _id: new Types.ObjectId(id),
      });
      await caregiver?.delete(new Types.ObjectId(deletedBy));
    }
  }

  async getCaregiver(id: string): Promise<Caregiver> {
    return this.caregiverModel.findOne({ _id: new Types.ObjectId(id) });
  }

  async updateCaregiver(updateCaregiverParams: UpdateCaregiverParams): Promise<Caregiver> {
    return this.caregiverModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateCaregiverParams.id) },
      {
        $set: {
          ...updateCaregiverParams,
          memberId: new Types.ObjectId(updateCaregiverParams.memberId),
          journeyId: new Types.ObjectId(updateCaregiverParams.journeyId),
        },
      },
      { upsert: true, new: true },
    );
  }

  async getCaregivers({
    memberId,
    journeyId,
  }: {
    memberId: string;
    journeyId: string;
  }): Promise<Caregiver[]> {
    return this.caregiverModel.find({
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteCaregivers(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteCaregivers.name,
      serviceName: CaregiverService.name,
    };
    await deleteMemberObjects<Model<CaregiverDocument> & ISoftDelete<CaregiverDocument>>({
      model: this.caregiverModel,
      ...data,
    });
  }
}
