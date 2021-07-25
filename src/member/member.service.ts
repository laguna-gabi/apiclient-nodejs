import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DbErrors, Errors, ErrorType, EventType, Identifier } from '../common';
import { CreateMemberParams, Member, MemberDocument } from '.';
import { cloneDeep } from 'lodash';
import { OnEvent } from '@nestjs/event-emitter';
import { Scores } from '../appointment';

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
      const primitiveValues = cloneDeep(createMemberParams);
      delete primitiveValues.orgId;
      delete primitiveValues.primaryCoachId;
      delete primitiveValues.usersIds;

      const result = await this.memberModel.create({
        ...primitiveValues,
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
      populate: 'notes',
    };

    return this.memberModel
      .findOne({ deviceId })
      .populate({ path: 'org' })
      .populate({ path: 'primaryCoach', populate: subPopulate })
      .populate({ path: 'users', populate: subPopulate });
  }

  @OnEvent(EventType.appointmentScoresUpdated, { async: true })
  async handleAppointmentScoreUpdated({
    memberId,
    scores,
  }: {
    memberId: Types.ObjectId;
    scores: Scores;
  }) {
    await this.memberModel.updateOne({ _id: memberId }, { $set: { scores } });
  }
}
