import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Errors, Id } from '../common';
import {
  CreateMemberParams,
  GetMemberParams,
  Member,
  MemberDocument,
} from './member.dto';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
  ) {}

  async insert(createMemberParams: CreateMemberParams): Promise<Id> {
    try {
      const result = await this.memberModel.create({
        phoneNumber: createMemberParams.phoneNumber,
        name: createMemberParams.name,
        primaryCoach: new Types.ObjectId(createMemberParams.primaryCoachId),
        coaches: createMemberParams.coachIds.map(
          (item) => new Types.ObjectId(item),
        ),
      });
      return { _id: result._id };
    } catch (ex) {
      throw new Error(
        ex.code === 11000
          ? `${Errors.member.create.title} : ${Errors.member.create.reasons.phoneNumber}`
          : ex,
      );
    }
  }

  async get(getMemberParams: GetMemberParams): Promise<Member> {
    return this.memberModel
      .findOne({ _id: getMemberParams.id })
      .populate('coaches')
      .populate('primaryCoach');
  }
}
