import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Errors, Identifier } from '../common';
import { CreateMemberParams, Member, MemberDocument } from './member.dto';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
  ) {}

  async insert(createMemberParams: CreateMemberParams): Promise<Identifier> {
    try {
      const result = await this.memberModel.create({
        phoneNumber: createMemberParams.phoneNumber,
        name: createMemberParams.name,
        dateOfBirth: createMemberParams.dateOfBirth,
        primaryCoach: new Types.ObjectId(createMemberParams.primaryCoachId),
        users: createMemberParams.usersIds?.map(
          (item) => new Types.ObjectId(item),
        ),
      });
      return { id: result._id };
    } catch (ex) {
      throw new Error(
        ex.code === 11000
          ? `${Errors.member.create.title} : ${Errors.member.create.reasons.phoneNumber}`
          : ex,
      );
    }
  }

  async get(id: string): Promise<Member> {
    return this.memberModel
      .findOne({ _id: id })
      .populate('users')
      .populate('primaryCoach');
  }
}
