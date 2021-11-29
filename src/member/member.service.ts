import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { sub } from 'date-fns';
import { cloneDeep, isNil, omitBy } from 'lodash';
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
  ControlMember,
  ControlMemberDocument,
  CreateMemberParams,
  CreateTaskParams,
  Goal,
  GoalDocument,
  ImageFormat,
  Journal,
  JournalDocument,
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
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateJournalParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '.';
import { Appointment } from '../appointment';
import {
  AppointmentStatus,
  BaseService,
  DbErrors,
  ErrorType,
  Errors,
  EventType,
  IEventOnNewAppointment,
  IEventOnNewMemberCommunication,
  IEventOnUpdatedAppointmentScores,
  IEventUnconsentedAppointmentEnded,
  Identifier,
  Logger,
} from '../common';
import { StorageService } from '../providers';

@Injectable()
export class MemberService extends BaseService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<GoalDocument>,
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument>,
    @InjectModel(Journal.name)
    private readonly journalModel: Model<JournalDocument>,
    @InjectModel(MemberConfig.name)
    private readonly memberConfigModel: Model<MemberConfigDocument>,
    @InjectModel(Recording.name)
    private readonly recordingModel: Model<RecordingDocument>,
    @InjectModel(ArchiveMember.name)
    private readonly archiveMemberModel: Model<ArchiveMemberDocument>,
    @InjectModel(ArchiveMemberConfig.name)
    private readonly archiveMemberConfigModel: Model<ArchiveMemberConfigDocument>,
    @InjectModel(NotifyParams.name)
    private readonly notifyParamsModel: Model<NotifyParamsDocument>,
    @InjectModel(ControlMember.name)
    private readonly controlMemberModel: Model<ControlMemberDocument>,
    private readonly storageService: StorageService,
    readonly logger: Logger,
  ) {
    super();
  }

  async insert(
    createMemberParams: CreateMemberParams,
    primaryUserId: string,
  ): Promise<{ member: Member; memberConfig: MemberConfig }> {
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

      const memberConfig = await this.memberConfigModel.create({
        memberId: new Types.ObjectId(object._id),
        externalUserId: v4(),
      });

      const member = await this.getById(object._id);

      return {
        member: this.replaceId(member.toObject()),
        memberConfig: this.replaceId(memberConfig.toObject()),
      };
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
      const primaryUser = item.users.filter((user) => user.id === item.primaryUserId.toString())[0];
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

  @OnEvent(EventType.onNewAppointment, { async: true })
  async handleAddUserToMemberList(params: IEventOnNewAppointment) {
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

  @OnEvent(EventType.onUnconsentedAppointmentEnded, { async: true })
  async handleUnconsentedAppointmentEnded(params: IEventUnconsentedAppointmentEnded) {
    try {
      const { appointmentId, memberId } = params;
      const recordingsToDeleteMedia = await this.recordingModel.find({
        appointmentId: Types.ObjectId(appointmentId),
        answered: true,
      });
      const recordingIds = recordingsToDeleteMedia.map((doc) => doc.id);
      await this.storageService.deleteRecordings(memberId, recordingIds);
      await this.recordingModel.updateMany(
        {
          appointmentId: Types.ObjectId(appointmentId),
          answered: true,
        },
        {
          deletedMedia: true,
        },
      );
    } catch (ex) {
      this.logger.error(
        params,
        MemberService.name,
        this.handleUnconsentedAppointmentEnded.name,
        ex,
      );
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
                $gte: sub(new Date(), { days: 2 }),
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

  async getNewRegisteredMembersWithNoDailyReports() {
    const result = await this.memberConfigModel.aggregate([
      {
        $match: {
          firstLoggedInAt: {
            $gte: sub(new Date(), { days: 3 }),
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
          from: 'dailyreports',
          localField: 'memberConfig.memberId',
          foreignField: 'memberId',
          as: 'dailyreports',
        },
      },
      {
        $project: {
          _id: 0,
          memberConfig: 1,
          member: 1,
          dailyreportsCount: { $size: '$dailyreports' },
        },
      },
    ]);
    return result.filter((newMember) => {
      newMember.memberConfig.id = newMember.memberConfig._id;
      newMember.member.id = newMember.member._id;
      delete newMember.memberConfig._id;
      delete newMember.member._id;
      return newMember.dailyreportsCount === 0;
    });
  }

  async moveMemberToArchive(id: string) {
    this.logger.debug({ memberId: id }, MemberService.name, this.moveMemberToArchive.name);
    const member = await this.get(id);
    const memberConfig = await this.getMemberConfig(id);

    await this.archiveMemberModel.insertMany(member);
    await this.archiveMemberConfigModel.insertMany(memberConfig);
    await this.memberModel.deleteOne({ _id: new Types.ObjectId(id) });
    await this.memberConfigModel.deleteOne({ memberId: new Types.ObjectId(id) });

    return { member, memberConfig };
  }

  async deleteMember(id: string) {
    this.logger.debug({ memberId: id }, MemberService.name, this.deleteMember.name);
    const member = await this.get(id);
    const memberConfig = await this.getMemberConfig(id);

    await this.memberModel.deleteOne({ _id: new Types.ObjectId(id) });
    await this.memberConfigModel.deleteOne({ memberId: new Types.ObjectId(id) });

    for (let index = 0; index < member.goals.length; index++) {
      await this.goalModel.deleteOne({ _id: member.goals[index] });
    }

    for (let index = 0; index < member.actionItems.length; index++) {
      await this.actionItemModel.deleteOne({ _id: member.actionItems[index] });
    }
    await this.recordingModel.deleteMany({ memberId: new Types.ObjectId(id) });

    return { member, memberConfig };
  }
  /************************************************************************************************
   ******************************************** Control *******************************************
   ************************************************************************************************/

  async insertControl(createMemberParams: CreateMemberParams): Promise<Member> {
    try {
      this.removeNotNullable(createMemberParams, NotNullableMemberKeys);
      const primitiveValues = cloneDeep(createMemberParams);
      delete primitiveValues.orgId;

      const member = await this.controlMemberModel.create({
        ...primitiveValues,
        org: new Types.ObjectId(createMemberParams.orgId),
      });

      return this.replaceId(member.toObject());
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.memberPhoneAlreadyExists) : ex,
      );
    }
  }

  async getControl(id: string) {
    return this.controlMemberModel.findById(id).populate({ path: 'org' });
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

  @OnEvent(EventType.onUpdatedAppointmentScores, { async: true })
  async handleAppointmentScoreUpdated(params: IEventOnUpdatedAppointmentScores) {
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

  async updateMemberConfig(
    updateMemberConfigParams: UpdateMemberConfigParams,
  ): Promise<MemberConfig> {
    const {
      memberId,
      platform,
      isPushNotificationsEnabled,
      isAppointmentsReminderEnabled,
      isRecommendationsEnabled,
    } = updateMemberConfigParams;

    let setParams: any = { memberId: new Types.ObjectId(memberId) };
    setParams = platform == null ? platform : { ...setParams, platform };
    setParams =
      isPushNotificationsEnabled == null ? setParams : { ...setParams, isPushNotificationsEnabled };
    setParams =
      isAppointmentsReminderEnabled == null
        ? setParams
        : { ...setParams, isAppointmentsReminderEnabled };
    setParams =
      isRecommendationsEnabled == null ? setParams : { ...setParams, isRecommendationsEnabled };

    return this.memberConfigModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $set: setParams },
      { new: true },
    );
  }

  async updateMemberConfigRegisteredAt(memberId: Types.ObjectId) {
    this.logger.debug({ memberId }, MemberService.name, this.updateMemberConfigRegisteredAt.name);
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

  @OnEvent(EventType.onNewMemberCommunication, { async: true })
  async handleUpdateMemberConfig(params: IEventOnNewMemberCommunication): Promise<boolean> {
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
      {
        $set: {
          generalNotes: setGeneralNotesParams.note,
          nurseNotes: setGeneralNotesParams.nurseNotes,
        },
      },
    );

    if (result.nModified === 0) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
  }

  /*************************************************************************************************
   ******************************************** Journal ********************************************
   ************************************************************************************************/

  async createJournal(memberId: string): Promise<Identifier> {
    const { _id } = await this.journalModel.create({ memberId: new Types.ObjectId(memberId) });
    return { id: _id };
  }

  async updateJournal(updateJournalParams: UpdateJournalParams): Promise<Journal> {
    const { id, text } = updateJournalParams;
    const result = await this.journalModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { text } },
      { new: true },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  async updateJournalImageFormat({
    id,
    imageFormat,
  }: {
    id: string;
    imageFormat: ImageFormat | null;
  }): Promise<Journal> {
    const result = await this.journalModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { imageFormat } },
      { new: true },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  async getJournal(id: string): Promise<Journal> {
    const result = await this.journalModel.findById(id);

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  async getJournals(memberId: string): Promise<Journal[]> {
    const result = await this.journalModel.find({
      memberId: new Types.ObjectId(memberId),
      text: { $exists: true },
    });

    return result;
  }

  async deleteJournal(id: string): Promise<Journal> {
    const result = await this.journalModel.findOneAndDelete({ _id: new Types.ObjectId(id) });

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  /*************************************************************************************************
   ******************************************** Recording ******************************************
   ************************************************************************************************/
  async updateRecording(updateRecordingParams: UpdateRecordingParams): Promise<void> {
    const { start, end, memberId, id, userId, phone, answered, appointmentId, recordingType } =
      updateRecordingParams;
    const member = await this.memberModel.findById(memberId, { _id: 1 });
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    const objectMemberId = new Types.ObjectId(memberId);
    const setParams: any = omitBy(
      {
        memberId: objectMemberId,
        start,
        end,
        userId,
        phone,
        answered,
        recordingType,
        appointmentId: appointmentId ? new Types.ObjectId(appointmentId) : null,
      },
      isNil,
    );

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

  /************************************************************************************************
   **************************************** Modifications *****************************************
   ************************************************************************************************/

  async updatePrimaryUser(params: ReplaceUserForMemberParams): Promise<Member> {
    this.logger.debug(params, MemberService.name, this.updatePrimaryUser.name);
    const { memberId, userId } = params;

    // replace primary user and add the new user to member's list
    const member = await this.memberModel.findOneAndUpdate(
      { _id: new Types.ObjectId(memberId) },
      { primaryUserId: new Types.ObjectId(userId), $addToSet: { users: userId } },
      { new: false },
    );
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    // if old user == new user
    if (member.primaryUserId.toString() === params.userId) {
      throw new Error(Errors.get(ErrorType.userIdOrEmailAlreadyExists));
    }
    // return the old member (with the old primaryUserId)
    return this.replaceId(member);
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
