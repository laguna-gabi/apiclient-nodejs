import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { sub } from 'date-fns';
import { cloneDeep } from 'lodash';
import { Model, Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  ActionItem,
  ActionItemDocument,
  AppointmentCompose,
  ArchiveMember,
  ArchiveMemberConfig,
  ArchiveMemberConfigDocument,
  ArchiveMemberDocument,
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
  NotifyParams,
  NotifyParamsDocument,
  Recording,
  RecordingDocument,
  RecordingOutput,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '.';
import { Appointment, AppointmentDocument } from '../appointment';
import {
  AppointmentStatus,
  BaseService,
  DbErrors,
  ErrorType,
  Errors,
  EventType,
  IEventAddUserToMemberList,
  IEventAppointmentScoresUpdated,
  IEventUpdateMemberConfig,
  Identifier,
  Logger,
  Platform,
} from '../common';

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
    @InjectModel(Recording.name)
    private readonly recordingModel: Model<RecordingDocument>,
    @InjectModel(ArchiveMember.name)
    private readonly archiveMemberModel: Model<ArchiveMemberDocument>,
    @InjectModel(ArchiveMemberConfig.name)
    private readonly archiveMemberConfigModel: Model<ArchiveMemberConfigDocument>,
    @InjectModel(NotifyParams.name)
    private readonly notifyParamsModel: Model<NotifyParamsDocument>,
    readonly logger: Logger,
  ) {
    super();
  }

  async insert(createMemberParams: CreateMemberParams, primaryUserId: string): Promise<Member> {
    try {
      this.removeNotNullable(createMemberParams, NotNullableMemberKeys);
      const primitiveValues = cloneDeep(createMemberParams);
      delete primitiveValues.orgId;

      const object = await this.memberModel.create({
        ...primitiveValues,
        org: new Types.ObjectId(createMemberParams.orgId),
        primaryUserId,
        users: [primaryUserId],
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

    const member = await this.getById(result.value?.id);
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return this.replaceId(member);
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

  async getByPhone(phone: string): Promise<Member> {
    const member = await this.memberModel.findOne(
      { $or: [{ phone }, { phoneSecondary: phone }] },
      { _id: 1 },
    );
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
  async handleAddUserToMemberList(params: IEventAddUserToMemberList) {
    try {
      const { memberId, userId } = params;
      await this.memberModel.updateOne(
        { _id: Types.ObjectId(memberId) },
        { $addToSet: { users: userId } },
      );
    } catch (ex) {
      this.logger.error(params, MemberService.name, this.handleAddUserToMemberList.name, ex);
    }
  }

  /*************************************************************************************************
   ******************************************* Scheduler *******************************************
   ************************************************************************************************/

  private ScheduledOrDoneAppointmentsCount = {
    ScheduledOrDoneAppointmentsCount: {
      $size: {
        $filter: {
          input: '$appointments',
          as: 'appointments',
          cond: {
            $or: [
              { $eq: ['$$appointments.status', 'done'] },
              { $eq: ['$$appointments.status', 'scheduled'] },
            ],
          },
        },
      },
    },
  };

  async getNewUnregisteredMembers() {
    const result = await this.memberModel.aggregate([
      { $match: { createdAt: { $gte: sub(new Date(), { days: 2 }) } } },
      { $project: { member: '$$ROOT' } },
      {
        $lookup: {
          from: 'memberconfigs',
          localField: 'member._id',
          foreignField: 'memberId',
          as: 'memberconfig',
        },
      },
      {
        $unwind: {
          path: '$memberconfig',
        },
      },
      {
        $match: {
          'memberconfig.platform': 'web',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'primaryUserId',
          foreignField: 'member._id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'member._id',
          foreignField: 'memberId',
          as: 'appointments',
        },
      },
      {
        $project: {
          _id: 0,
          member: 1,
          user: { $arrayElemAt: ['$user', 0] },
          appointmentId: {
            $toString: {
              $arrayElemAt: ['$appointments._id', 0],
            },
          },
          ...this.ScheduledOrDoneAppointmentsCount,
        },
      },
    ]);
    return result.filter((newMember) => {
      newMember.user.id = newMember.user._id;
      newMember.member.id = newMember.member._id;
      delete newMember.user._id;
      delete newMember.member._id;
      return newMember.ScheduledOrDoneAppointmentsCount === 0;
    });
  }

  async getNewRegisteredMembers({ nudge }: { nudge: boolean }) {
    const result = await this.memberConfigModel.aggregate([
      {
        $match: {
          firstLoggedInAt: nudge
            ? {
                $gte: sub(new Date(), { days: 3 }),
                $lte: sub(new Date(), { days: 1 }),
              }
            : {
                $gte: sub(new Date(), { days: 1 }),
              },
        },
      },
      { $project: { memberConfig: '$$ROOT' } },
      {
        $lookup: {
          from: 'members',
          localField: 'memberConfig.memberId',
          foreignField: '_id',
          as: 'member',
        },
      },
      {
        $unwind: {
          path: '$member',
        },
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'memberConfig.memberId',
          foreignField: 'memberId',
          as: 'appointments',
        },
      },
      {
        $project: {
          _id: 0,
          memberConfig: 1,
          member: 1,
          ...this.ScheduledOrDoneAppointmentsCount,
        },
      },
    ]);
    return result.filter((newMember) => {
      newMember.memberConfig.id = newMember.memberConfig._id;
      newMember.member.id = newMember.member._id;
      delete newMember.memberConfig._id;
      delete newMember.member._id;
      return newMember.ScheduledOrDoneAppointmentsCount === 0;
    });
  }

  async moveMemberToArchive(id: string) {
    const member = await this.get(id);
    const memberConfig = await this.getMemberConfig(id);

    await this.archiveMemberModel.insertMany(member);
    await this.archiveMemberConfigModel.insertMany(memberConfig);
    await this.memberModel.deleteOne({ _id: new Types.ObjectId(id) });
    await this.memberConfigModel.deleteOne({ memberId: new Types.ObjectId(id) });

    this.logger.debug({ memberId: id }, MemberService.name, this.moveMemberToArchive.name);
    return { member, memberConfig };
  }

  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/

  async getMemberNotifications(memberId: string) {
    return this.notifyParamsModel.find({ memberId });
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
  async handleAppointmentScoreUpdated(params: IEventAppointmentScoresUpdated) {
    try {
      await this.memberModel.updateOne(
        { _id: params.memberId },
        { $set: { scores: params.scores } },
      );
    } catch (ex) {
      this.logger.error(params, MemberService.name, this.handleAppointmentScoreUpdated.name, ex);
    }
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
    platform,
    isPushNotificationsEnabled,
  }: {
    memberId: Types.ObjectId;
    platform: Platform;
    isPushNotificationsEnabled?: boolean;
  }): Promise<boolean> {
    const setPush = isPushNotificationsEnabled !== undefined ? { isPushNotificationsEnabled } : {};
    const result = await this.memberConfigModel.updateOne(
      { memberId },
      { $set: { memberId, platform, ...setPush } },
    );

    return result.ok === 1;
  }

  async updateMemberConfigRegisteredAt(memberId: Types.ObjectId) {
    const result = await this.memberConfigModel.updateOne(
      { memberId },
      { $set: { firstLoggedInAt: new Date() } },
    );

    return result.ok === 1;
  }

  async getMemberConfig(id: string): Promise<MemberConfig> {
    const memberConfig = await this.memberConfigModel.findOne({ memberId: new Types.ObjectId(id) });
    if (!memberConfig) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    memberConfig.articlesPath = await this.getArticlesPath(id);
    return this.replaceId(memberConfig);
  }

  @OnEvent(EventType.updateMemberConfig, { async: true })
  async handleUpdateMemberConfig(params: IEventUpdateMemberConfig): Promise<boolean> {
    try {
      const result = await this.memberConfigModel.updateOne(
        { memberId: new Types.ObjectId(params.memberId) },
        { $set: { accessToken: params.accessToken } },
      );

      return result.ok === 1;
    } catch (ex) {
      this.logger.error(params, MemberService.name, this.handleUpdateMemberConfig.name, ex);
    }
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
   ******************************************** Recording ******************************************
   ************************************************************************************************/
  async updateRecording(updateRecordingParams: UpdateRecordingParams): Promise<void> {
    const { start, end, memberId, id, userId, phone, answered } = updateRecordingParams;
    const member = await this.memberModel.findById(memberId, { _id: 1 });
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    const objectMemberId = new Types.ObjectId(memberId);
    let setParams: any = { memberId: objectMemberId };
    setParams = start ? { ...setParams, start } : setParams;
    setParams = end ? { ...setParams, end } : setParams;
    setParams = userId ? { ...setParams, userId } : setParams;
    setParams = phone ? { ...setParams, phone } : setParams;
    setParams = answered ? { ...setParams, answered } : setParams;

    try {
      await this.recordingModel.updateOne(
        { id, memberId: objectMemberId },
        { $set: setParams },
        { new: true, upsert: true },
      );
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey
          ? Errors.get(ErrorType.memberRecordingIdAlreadyExists)
          : ex,
      );
    }
  }

  async getRecordings(memberId: string): Promise<RecordingOutput[]> {
    return this.recordingModel.find({ memberId: new Types.ObjectId(memberId) });
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
      .filter((app: Appointment) => app.memberId.toString() === member.id.toString());

    const nextAppointment = allAppointments
      .filter(
        (appointment) =>
          appointment?.status === AppointmentStatus.scheduled &&
          appointment?.start.getTime() >= Date.now(),
      )
      .sort((appointment1, appointment2) =>
        appointment1.start.getTime() > appointment2.start.getTime() ? 1 : -1,
      )[0]?.start;

    const appointmentsCount = allAppointments.filter(
      (appointment) => appointment?.status !== AppointmentStatus.requested,
    ).length;

    return { appointmentsCount, nextAppointment };
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

  private async getArticlesPath(id: string) {
    const { drg } = await this.get(id);
    return config.get('articlesByDrg')[drg] || config.get('articlesByDrg.default');
  }
}
