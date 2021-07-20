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

  async insert({
    createMemberParams,
    dischargeNotesLink,
    dischargeInstructionsLink,
  }: {
    createMemberParams: CreateMemberParams;
    dischargeNotesLink: string;
    dischargeInstructionsLink: string;
  }): Promise<Identifier> {
    try {
      const result = await this.memberModel.create({
        phoneNumber: createMemberParams.phoneNumber,
        deviceId: createMemberParams.deviceId,
        firstName: createMemberParams.firstName,
        lastName: createMemberParams.lastName,
        dateOfBirth: createMemberParams.dateOfBirth,
        org: new Types.ObjectId(createMemberParams.orgId),
        primaryCoach: new Types.ObjectId(createMemberParams.primaryCoachId),
        users: createMemberParams.usersIds?.map((item) => new Types.ObjectId(item)),
        dischargeNotesLink,
        dischargeInstructionsLink,
      });
      return { id: result._id };
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.memberPhoneAlreadyExists) : ex,
      );
    }
  }

  async get(deviceId: string): Promise<Member> {
    const member = await this.memberModel.findOne({ deviceId }, { _id: 1 });
    if (!member) {
      return null;
    }

    const subPopulate = {
      path: 'appointments',
      match: { memberId: new Types.ObjectId(member._id) },
    };

    return this.memberModel
      .findOne({ deviceId })
      .populate({ path: 'org' })
      .populate({ path: 'primaryCoach', populate: subPopulate })
      .populate({ path: 'users', populate: subPopulate });
  }
}
