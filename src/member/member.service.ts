import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DbErrors, Errors, ErrorType, Identifier } from '../common';
import { CreateMemberParams, Member, MemberDocument } from '.';

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
        deviceId: createMemberParams.deviceId,
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
        ex.code === DbErrors.duplicateKey
          ? Errors.get(ErrorType.memberPhoneAlreadyExists)
          : ex,
      );
    }
  }

  async get(deviceId: string): Promise<Member> {
    return this.memberModel
      .findOne({ deviceId })
      .populate('users')
      .populate('primaryCoach');
  }
}
