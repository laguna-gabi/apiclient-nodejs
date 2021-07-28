import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DbErrors, Errors, ErrorType, EventType, Identifier } from '../common';
import {
  ActionItem,
  ActionItemDocument,
  CreateMemberParams,
  CreateTaskParams,
  Goal,
  GoalDocument,
  Member,
  MemberDocument,
  MemberSummary,
  TaskState,
  UpdateMemberParams,
  UpdateTaskStateParams,
} from '.';
import { cloneDeep } from 'lodash';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentStatus, Scores } from '../appointment';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<GoalDocument>,
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument>,
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

  async update(updateMemberParams: UpdateMemberParams): Promise<Member> {
    const { id } = updateMemberParams;
    delete updateMemberParams.id;

    const result = await this.memberModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: updateMemberParams },
      { new: true, rawResult: true },
    );

    if (!result.value) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return result.value;
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

    const options = { sort: { updatedAt: -1 } };

    return this.memberModel
      .findOne({ deviceId })
      .populate({ path: 'org' })
      .populate({ path: 'goals', options })
      .populate({ path: 'actionItems', options })
      .populate({ path: 'primaryCoach', populate: subPopulate })
      .populate({ path: 'users', populate: subPopulate });
  }

  async getByOrg(orgId?: string): Promise<MemberSummary[]> {
    const filter = orgId ? { org: new Types.ObjectId(orgId) } : {};

    let result = await this.memberModel.aggregate([
      { $match: filter },
      {
        $project: {
          id: '$_id',
          name: { $concat: ['$firstName', ' ', '$lastName'] },
          phoneNumber: '$phoneNumber',
          dischargeDate: { $ifNull: ['$dischargeDate', undefined] },
          adherence: { $ifNull: ['$scores.adherence', 0] },
          wellbeing: { $ifNull: ['$scores.wellbeing', 0] },
          createdAt: '$createdAt',
          goalsCount: { $size: '$goals' },
          actionItemsCount: { $size: '$actionItems' },
          primaryCoach: '$primaryCoach',
          users: '$users',
        },
      },
    ]);

    result = await this.memberModel.populate(result, [
      { path: 'primaryCoach', options: { populate: 'appointments' } },
      { path: 'users', options: { populate: 'appointments' } },
    ]);

    return result.map((item) => {
      const { appointmentsCount, nextAppointment } = this.calculateAppointments(item);
      delete item.users;
      delete item._id;

      return { ...item, appointmentsCount, nextAppointment };
    });
  }

  /*************************************************************************************************
   ********************************************* Goals *********************************************
   ************************************************************************************************/

  async insertGoal({
    createTaskParams,
    state,
  }: {
    createTaskParams: CreateTaskParams;
    state: TaskState;
  }): Promise<Identifier> {
    const { memberId } = createTaskParams;
    delete createTaskParams.memberId;

    const { _id } = await this.goalModel.create({ ...createTaskParams, state });

    await this.memberModel.updateOne(
      { _id: new Types.ObjectId(memberId) },
      { $push: { goals: _id } },
    );

    return { id: _id };
  }

  async updateGoalState(updateTaskStateParams: UpdateTaskStateParams): Promise<void> {
    const { id, state } = updateTaskStateParams;

    const result = await this.goalModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { state } },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberGoalIdNotFound));
    }
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

  /*************************************************************************************************
   ****************************************** Action item ******************************************
   ************************************************************************************************/

  async insertActionItem({
    createTaskParams,
    state,
  }: {
    createTaskParams: CreateTaskParams;
    state: TaskState;
  }): Promise<Identifier> {
    const { memberId } = createTaskParams;
    delete createTaskParams.memberId;

    const { _id } = await this.actionItemModel.create({ ...createTaskParams, state });

    await this.memberModel.updateOne(
      { _id: new Types.ObjectId(memberId) },
      { $push: { actionItems: _id } },
    );

    return { id: _id };
  }

  async updateActionItemState(updateTaskStateParams: UpdateTaskStateParams): Promise<void> {
    const { id, state } = updateTaskStateParams;

    const result = await this.actionItemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { state } },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberActionItemIdNotFound));
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private calculateAppointments = (
    member: Member,
  ): { appointmentsCount: number; nextAppointment: Date } => {
    const allAppointments = member.users
      .map((user) => user.appointments)
      .reduce((acc = [], current) => acc.concat(current), [])
      .concat(member.primaryCoach?.appointments);

    const nextAppointment = allAppointments
      .filter(
        (appointment) =>
          appointment?.status === AppointmentStatus.scheduled &&
          appointment?.start.getTime() >= Date.now(),
      )
      .sort((appointment1, appointment2) =>
        appointment1.start.getTime() > appointment2.start.getTime() ? 1 : -1,
      )[0]?.start;

    return { appointmentsCount: allAppointments.length, nextAppointment };
  };
}
