import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BaseService,
  DbErrors,
  Errors,
  ErrorType,
  EventType,
  Identifier,
  MobilePlatform,
} from '../common';
import {
  ActionItem,
  ActionItemDocument,
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  Goal,
  GoalDocument,
  Member,
  MemberConfig,
  MemberConfigDocument,
  MemberDocument,
  MemberSummary,
  NotNullableMemberKeys,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '.';
import { cloneDeep } from 'lodash';
import { OnEvent } from '@nestjs/event-emitter';
import { Appointment, AppointmentDocument, AppointmentStatus, Scores } from '../appointment';
import { v4 } from 'uuid';

@Injectable()
export class MemberService extends BaseService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<GoalDocument>,
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument>,
    @InjectModel(MemberConfig.name)
    private readonly memberConfigModel: Model<MemberConfigDocument>,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
  ) {
    super();
  }

  async insert(createMemberParams: CreateMemberParams) {
    try {
      this.removeNotNullable(createMemberParams, NotNullableMemberKeys);
      const primitiveValues = cloneDeep(createMemberParams);
      delete primitiveValues.orgId;
      delete primitiveValues.usersIds;

      const object = await this.memberModel.create({
        ...primitiveValues,
        org: new Types.ObjectId(createMemberParams.orgId),
        users: createMemberParams.usersIds,
      });

      await this.memberConfigModel.create({
        memberId: new Types.ObjectId(object._id),
        externalUserId: v4(),
      });

      return this.replaceId(object.toObject());
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.memberPhoneAlreadyExists) : ex,
      );
    }
  }

  async update(updateMemberParams: UpdateMemberParams): Promise<Member> {
    this.removeNotNullable(updateMemberParams, NotNullableMemberKeys);
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

    return this.replaceId(result.value.toObject());
  }

  async get(id: string): Promise<Member> {
    const member = await this.memberModel.findById(id, { _id: 1 });
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return this.getById(id);
  }

  async getByDeviceId(deviceId: string): Promise<Member> {
    const member = await this.memberModel.findOne({ deviceId }, { _id: 1 });
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return this.getById(member._id);
  }

  async getByOrg(orgId?: string): Promise<MemberSummary[]> {
    const filter = orgId ? { org: new Types.ObjectId(orgId) } : {};

    let result = await this.memberModel.aggregate([
      { $match: filter },
      {
        $project: {
          id: '$_id',
          name: { $concat: ['$firstName', ' ', '$lastName'] },
          phone: '$phone',
          dischargeDate: { $ifNull: ['$dischargeDate', undefined] },
          adherence: { $ifNull: ['$scores.adherence', 0] },
          wellbeing: { $ifNull: ['$scores.wellbeing', 0] },
          createdAt: '$createdAt',
          goalsCount: { $size: '$goals' },
          actionItemsCount: { $size: '$actionItems' },
          primaryUserId: '$primaryUserId',
          users: '$users',
        },
      },
    ]);

    result = await this.memberModel.populate(result, [
      { path: 'users', options: { populate: 'appointments' } },
    ]);

    return result.map((item) => {
      const { appointmentsCount, nextAppointment } = this.calculateAppointments(item);
      const primaryUser = item.users.filter((user) => user.id === item.primaryUserId)[0];
      delete item.users;
      delete item._id;

      return { ...item, primaryUser, appointmentsCount, nextAppointment };
    });
  }

  async getMembersAppointments(orgId?: string): Promise<AppointmentCompose[]> {
    return this.memberModel.aggregate([
      {
        $project: {
          _id: 0,
          members: '$$ROOT',
        },
      },
      { $match: orgId ? { 'members.org': new Types.ObjectId(orgId) } : {} },
      {
        $lookup: {
          localField: 'members._id',
          from: 'appointments',
          foreignField: 'memberId',
          as: 'a',
        },
      },
      { $unwind: { path: '$a' } },
      { $match: { 'a.status': AppointmentStatus.scheduled } },
      {
        $lookup: {
          localField: 'a.userId',
          from: 'users',
          foreignField: '_id',
          as: 'u',
        },
      },
      { $unwind: { path: '$u' } },
      { $sort: { 'a.start': -1 } },
      {
        $project: {
          memberId: '$members._id',
          memberName: { $concat: ['$members.firstName', ' ', '$members.lastName'] },
          userId: '$a.userId',
          userName: { $concat: ['$u.firstName', ' ', '$u.lastName'] },
          start: '$a.start',
          end: '$a.end',
        },
      },
    ]);
  }

  @OnEvent(EventType.addUserToMemberList, { async: true })
  async handleAddUserToMemberList({ memberId, userId }: { memberId: string; userId: string }) {
    await this.memberModel.updateOne(
      { _id: Types.ObjectId(memberId) },
      { $addToSet: { users: userId } },
    );
  }

  /*************************************************************************************************
   ********************************************* Goals *********************************************
   ************************************************************************************************/

  async insertGoal({
    createTaskParams,
    status,
  }: {
    createTaskParams: CreateTaskParams;
    status: TaskStatus;
  }): Promise<Identifier> {
    const { memberId } = createTaskParams;
    delete createTaskParams.memberId;

    const { _id } = await this.goalModel.create({ ...createTaskParams, status });

    await this.memberModel.updateOne(
      { _id: new Types.ObjectId(memberId) },
      { $push: { goals: _id } },
    );

    return { id: _id };
  }

  async updateGoalStatus(updateTaskStatusParams: UpdateTaskStatusParams): Promise<void> {
    const { id, status } = updateTaskStatusParams;

    const result = await this.goalModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { status } },
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
    status,
  }: {
    createTaskParams: CreateTaskParams;
    status: TaskStatus;
  }): Promise<Identifier> {
    const { memberId } = createTaskParams;
    delete createTaskParams.memberId;

    const { _id } = await this.actionItemModel.create({ ...createTaskParams, status });

    await this.memberModel.updateOne(
      { _id: new Types.ObjectId(memberId) },
      { $push: { actionItems: _id } },
    );

    return { id: _id };
  }

  async updateActionItemStatus(updateTaskStatusParams: UpdateTaskStatusParams): Promise<void> {
    const { id, status } = updateTaskStatusParams;

    const result = await this.actionItemModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { status } },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberActionItemIdNotFound));
    }
  }

  /************************************************************************************************
   ***************************************** Member Config ****************************************
   ************************************************************************************************/

  async updateMemberConfig({
    memberId,
    mobilePlatform,
  }: {
    memberId: Types.ObjectId;
    mobilePlatform: MobilePlatform;
  }): Promise<boolean> {
    const result = await this.memberConfigModel.updateOne(
      { memberId },
      { $set: { memberId, mobilePlatform } },
    );

    return result.ok === 1;
  }

  async getMemberConfig(id: string): Promise<MemberConfig> {
    const object = await this.memberConfigModel.findOne({ memberId: new Types.ObjectId(id) });
    if (!object) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return this.replaceId(object.toObject());
  }

  @OnEvent(EventType.updateMemberConfig, { async: true })
  async handleupdateMemberConfig({
    memberId,
    accessToken,
  }: {
    memberId: Types.ObjectId;
    accessToken: string;
  }): Promise<boolean> {
    const result = await this.memberConfigModel.updateOne({ memberId }, { $set: { accessToken } });

    return result.ok === 1;
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/
  async setGeneralNotes(setGeneralNotesParams: SetGeneralNotesParams): Promise<void> {
    const result = await this.memberModel.updateOne(
      { _id: new Types.ObjectId(setGeneralNotesParams.memberId) },
      { $set: { generalNotes: setGeneralNotesParams.note } },
    );

    if (result.nModified === 0) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
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
      .reduce((acc = [], current) => acc.concat(current), []);

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

  private async getById(id: string) {
    const subPopulate = {
      path: 'appointments',
      match: { memberId: new Types.ObjectId(id) },
      populate: 'notes',
    };

    const options = { sort: { updatedAt: -1 } };

    return this.memberModel
      .findOne({ _id: id })
      .populate({ path: 'org' })
      .populate({ path: 'goals', options })
      .populate({ path: 'actionItems', options })
      .populate({ path: 'users', populate: subPopulate });
  }
}
