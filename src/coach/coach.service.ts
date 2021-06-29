import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coach, CoachDocument, CreateCoachParams } from './coach.dto';
import { Errors, Id } from '../common';

@Injectable()
export class CoachService {
  constructor(
    @InjectModel(Coach.name)
    private readonly coachModel: Model<CoachDocument>,
  ) {}

  async get(id: string): Promise<Coach> {
    return this.coachModel.findById({ _id: id });
  }

  async insert(createCoachParams: CreateCoachParams): Promise<Id> {
    try {
      const { _id } = await this.coachModel.create(createCoachParams);
      return { id: _id };
    } catch (ex) {
      throw new Error(
        ex.code === 11000
          ? `${Errors.coach.create.title} : ${Errors.coach.create.reasons.email}`
          : ex,
      );
    }
  }
}
