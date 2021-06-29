import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Id } from '../common';
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
    const result = await this.memberModel.create({
      name: createMemberParams.name,
      primaryCoach: new Types.ObjectId(createMemberParams.primaryCoachId),
      coaches: createMemberParams.coachIds.map(
        (item) => new Types.ObjectId(item),
      ),
    });
    return { _id: result._id };
  }

  async get(getMemberParams: GetMemberParams): Promise<Member> {
    const result = await this.memberModel
      .findOne({ _id: getMemberParams.id })
      .populate('coaches')
      .populate('primaryCoach');

    console.log(result);
    return result;
  }
}
