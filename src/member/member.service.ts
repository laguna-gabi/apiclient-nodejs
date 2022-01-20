import { formatEx } from '@lagunahealth/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as config from 'config';
import { sub } from 'date-fns';
import { cloneDeep, isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import { Dispatch, NotificationService } from '../../src/services';
import { v4 } from 'uuid';
import {
  ActionItem,
  ActionItemDocument,
  AddCaregiverParams,
  Alert,
  AlertType,
  AppointmentCompose,
  ArchiveMember,
  ArchiveMemberConfig,
  ArchiveMemberConfigDocument,
  ArchiveMemberDocument,
  Caregiver,
  CaregiverDocument,
  ControlMember,
  ControlMemberDocument,
  CreateTaskParams,
  DismissedAlert,
  DismissedAlertDocument,
  EmbeddedMemberProperties,
  Goal,
  GoalDocument,
  InternalCreateMemberParams,
  Journal,
  JournalDocument,
  Member,
  MemberConfig,
  MemberConfigDocument,
  MemberDocument,
  MemberSummary,
  NotNullableMemberKeys,
  Recording,
  RecordingDocument,
  RecordingOutput,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateCaregiverParams,
  UpdateJournalParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
  UpdateTaskStatusParams,
} from '.';
import { Appointment, AppointmentStatus } from '../appointment';
import {
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
  LoggerService,
  extractEmbeddedSetObject,
} from '../common';
import { StorageService } from '../providers';
import { differenceInMilliseconds } from 'date-fns';

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
    @InjectModel(ControlMember.name)
    private readonly controlMemberModel: Model<ControlMemberDocument>,
    @InjectModel(Caregiver.name)
    private readonly caregiverModel: Model<CaregiverDocument>,
    @InjectModel(DismissedAlert.name)
    private readonly dismissAlertModel: Model<DismissedAlertDocument>,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    readonly logger: LoggerService,
  ) {
    super();
  }

  async insert(
    params: InternalCreateMemberParams,
    primaryUserId: Types.ObjectId,
  ): Promise<{ member: Member; memberConfig: MemberConfig }> {
    try {
      this.removeNotNullable(params, NotNullableMemberKeys);
      const { language, ...memberParams } = params;
      const primitiveValues = cloneDeep(memberParams);
      delete primitiveValues.orgId;
      delete primitiveValues.userId;

      const object = await this.memberModel.create({
        ...primitiveValues,
        org: new Types.ObjectId(memberParams.orgId),
        primaryUserId,
        users: [primaryUserId],
      });

      const memberConfig = await this.memberConfigModel.create({
        memberId: new Types.ObjectId(object._id),
        externalUserId: v4(),
        language,
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
    const { id, readmissionRisk } = updateMemberParams;
    delete updateMemberParams.id;

    // support patch for embedded objects:
    let setEmbeddedObjects = {};

    EmbeddedMemberProperties.forEach((prop) => {
      const embeddedSetObject = extractEmbeddedSetObject(updateMemberParams, prop);
      delete updateMemberParams[prop];
      setEmbeddedObjects = { ...setEmbeddedObjects, ...embeddedSetObject };
    });

    const result = await this.memberModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      {
        $set: { ...updateMemberParams, ...setEmbeddedObjects },
      },
      { rawResult: true },
    );

    if (readmissionRisk !== result.value?.readmissionRisk) {
      await this.memberModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id) },
        { $push: { readmissionRiskHistory: { readmissionRisk, date: new Date() } } },
        { rawResult: true },
      );
    }

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
          phoneType: '$phoneType',
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
    this.logger.info(params, MemberService.name, this.handleAddUserToMemberList.name);
    try {
      const { memberId, userId } = params;
      await this.memberModel.updateOne(
        { _id: Types.ObjectId(memberId) },
        { $addToSet: { users: userId } },
      );
    } catch (ex) {
      this.logger.error(
        params,
        MemberService.name,
        this.handleAddUserToMemberList.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onUnconsentedAppointmentEnded, { async: true })
  async handleUnconsentedAppointmentEnded(params: IEventUnconsentedAppointmentEnded) {
    this.logger.info(params, MemberService.name, this.handleUnconsentedAppointmentEnded.name);
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
        formatEx(ex),
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

  async moveMemberToArchive(id: string): Promise<{ member: Member; memberConfig: MemberConfig }> {
    this.logger.info({ memberId: id }, MemberService.name, this.moveMemberToArchive.name);
    const member = await this.get(id);
    const memberConfig = await this.getMemberConfig(id);

    await this.archiveMemberModel.insertMany(member);
    await this.archiveMemberConfigModel.insertMany(memberConfig);
    await this.memberModel.deleteOne({ _id: new Types.ObjectId(id) });
    await this.memberConfigModel.deleteOne({ memberId: new Types.ObjectId(id) });

    return { member, memberConfig };
  }

  async deleteMember(id: string): Promise<{ member: Member; memberConfig: MemberConfig }> {
    this.logger.info({ memberId: id }, MemberService.name, this.deleteMember.name);
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

  async insertControl(params: InternalCreateMemberParams): Promise<Member> {
    try {
      this.removeNotNullable(params, NotNullableMemberKeys);
      const primitiveValues = cloneDeep(params);
      delete primitiveValues.orgId;

      const member = await this.controlMemberModel.create({
        ...primitiveValues,
        org: new Types.ObjectId(params.orgId),
      });

      return this.controlMemberModel.findOne({ _id: member.id }).populate({ path: 'org' });
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.memberPhoneAlreadyExists) : ex,
      );
    }
  }

  async getAllControl(): Promise<MemberDocument[]> {
    return this.controlMemberModel.find();
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
    this.logger.info(params, MemberService.name, this.handleAppointmentScoreUpdated.name);
    try {
      await this.memberModel.updateOne(
        { _id: params.memberId },
        { $set: { scores: params.scores } },
      );
    } catch (ex) {
      this.logger.error(
        params,
        MemberService.name,
        this.handleAppointmentScoreUpdated.name,
        formatEx(ex),
      );
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
    const { memberId, ...setParams } = updateMemberConfigParams;
    this.removeNotNullable(setParams, Object.keys(setParams));

    const memberConfig = await this.memberConfigModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $set: setParams },
      { new: true },
    );
    if (!memberConfig) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return memberConfig;
  }

  async updateMemberConfigRegisteredAt(memberId: Types.ObjectId) {
    this.logger.info({ memberId }, MemberService.name, this.updateMemberConfigRegisteredAt.name);
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
    this.logger.info(params, MemberService.name, this.handleUpdateMemberConfig.name);
    try {
      const result = await this.memberConfigModel.updateOne(
        { memberId: new Types.ObjectId(params.memberId) },
        { $set: { accessToken: params.accessToken } },
      );

      return result.ok === 1;
    } catch (ex) {
      this.logger.error(
        params,
        MemberService.name,
        this.handleUpdateMemberConfig.name,
        formatEx(ex),
      );
    }
  }

  /*************************************************************************************************
   ****************************************** General notes ****************************************
   ************************************************************************************************/
  async setGeneralNotes(setGeneralNotesParams: SetGeneralNotesParams): Promise<void> {
    const setParams = omitBy(
      {
        generalNotes: setGeneralNotesParams.note,
        nurseNotes: setGeneralNotesParams.nurseNotes,
      },
      isNil,
    );
    const result = await this.memberModel.updateOne(
      { _id: new Types.ObjectId(setGeneralNotesParams.memberId) },
      { $set: setParams },
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
    const { id, memberId } = updateJournalParams;
    delete updateJournalParams.id;
    delete updateJournalParams.memberId;

    const result = await this.journalModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), memberId: new Types.ObjectId(memberId) },
      { $set: updateJournalParams },
      { new: true },
    );

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  async getJournal(id: string, memberId: string): Promise<Journal> {
    const result = await this.journalModel.findOne({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  async getJournals(memberId: string): Promise<Journal[]> {
    return this.journalModel.find({
      memberId: new Types.ObjectId(memberId),
      text: { $exists: true },
    });
  }

  async deleteJournal(id: string, memberId: string): Promise<Journal> {
    const result = await this.journalModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      memberId: new Types.ObjectId(memberId),
    });

    if (!result) {
      throw new Error(Errors.get(ErrorType.memberJournalNotFound));
    }

    return result;
  }

  /*************************************************************************************************
   ******************************************** Recording ******************************************
   ************************************************************************************************/
  async updateRecording(updateRecordingParams: UpdateRecordingParams, userId): Promise<Recording> {
    const { start, end, memberId, id, phone, answered, appointmentId, recordingType } =
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

    if (id) {
      const exists = await this.recordingModel.findOne({ id });
      if (exists && exists.memberId.toString() !== objectMemberId.toString()) {
        throw new Error(Errors.get(ErrorType.memberRecordingSameUserEdit));
      }
      const result = await this.recordingModel.findOneAndUpdate({ id }, setParams, {
        upsert: true,
        new: true,
        rawResult: true,
      });
      return result.value.toObject();
    } else {
      const result = await this.recordingModel.create({ ...setParams, id: v4() });
      return result.toObject() as RecordingDocument;
    }
  }

  async updateRecordingReview(
    updateRecordingReviewParams: UpdateRecordingReviewParams,
    userId,
  ): Promise<void> {
    const { recordingId, content } = updateRecordingReviewParams;

    const recording = await this.recordingModel.findOne({ id: recordingId });

    if (!recording) {
      throw new Error(Errors.get(ErrorType.memberRecordingNotFound));
    }

    const objectUserId = new Types.ObjectId(userId);

    // User cannot review own recording
    if (recording.userId.toString() === objectUserId.toString()) {
      throw new Error(Errors.get(ErrorType.memberRecordingSameUser));
    }

    // Only user who wrote review can update it
    if (
      recording.review?.userId &&
      recording.review.userId.toString() !== objectUserId.toString()
    ) {
      throw new Error(Errors.get(ErrorType.memberRecordingSameUserEdit));
    }

    if (recording.review) {
      await this.recordingModel.updateOne(
        { id: recordingId },
        {
          $set: {
            'review.userId': objectUserId,
            'review.content': content,
          },
        },
        { new: true, upsert: true },
      );
    } else {
      await this.recordingModel.findOneAndUpdate(
        { id: recordingId },
        {
          $set: {
            review: {
              userId: objectUserId,
              content,
              createdAt: null,
              updatedAt: null,
            },
          },
        },
        { new: true, upsert: true },
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
    this.logger.info(params, MemberService.name, this.updatePrimaryUser.name);
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
      throw new Error(Errors.get(ErrorType.memberReplaceUserAlreadyExists));
    }
    // return the old member (with the old primaryUserId)
    return this.replaceId(member);
  }

  /*************************************************************************************************
   ******************************************* Caregivers ******************************************
   ************************************************************************************************/

  async addCaregiver(memberId: string, addCaregiverParams: AddCaregiverParams): Promise<Caregiver> {
    return this.replaceId(
      await this.caregiverModel.create({
        ...addCaregiverParams,
        memberId: new Types.ObjectId(memberId),
      }),
    );
  }

  async deleteCaregiver(id: string) {
    return this.caregiverModel.remove({ _id: new Types.ObjectId(id) });
  }

  async getCaregiver(id: string): Promise<Caregiver> {
    return this.caregiverModel.findOne({ _id: new Types.ObjectId(id) });
  }

  async updateCaregiver(
    memberId: string,
    updateCaregiverParams: UpdateCaregiverParams,
  ): Promise<Caregiver> {
    return this.caregiverModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateCaregiverParams.id) },
      { $set: { ...updateCaregiverParams, memberId: new Types.ObjectId(memberId) } },
      { upsert: true, new: true },
    );
  }

  async getCaregiversByMemberId(memberId: string): Promise<Caregiver[]> {
    return this.caregiverModel.find({ memberId: new Types.ObjectId(memberId) });
  }

  /*************************************************************************************************
   ******************************************* Alerts ******************************************
   ************************************************************************************************/
  async dismissAlert(userId: string, alertId: string) {
    return this.dismissAlertModel.findOneAndUpdate({ alertId, userId }, undefined, {
      upsert: true,
    });
  }

  async getAlerts(userId: string, lastQueryAlert: Date): Promise<Alert[]> {
    let alerts = [];

    // Get all user's dismissed alerts
    const dismissedAlertsIds = (await this.getUserDismissedAlerts(userId)).map(
      (dismissedAlerts) => dismissedAlerts.alertId,
    );

    const members = await this.getMembersForPrimaryUser(userId);

    // Generate Notification (Dispatch) based Alerts: collect all Notifications (Dispatch) sent from every member on my list
    alerts = alerts
      .concat(
        ...(await Promise.all(
          members?.map(async (member) => {
            const dispatches = await this.notificationService.getDispatchesByClientSenderId(
              member.id,
            );

            return dispatches?.map((dispatch) =>
              this.notificationDispatchToAlerts(dispatch, member),
            );
          }),
        )),
      )
      .flat()
      .filter((alert) => alert !== undefined);

    // Generate Member based alerts:
    // TBD

    // Generate Appointment based alerts:
    // TBD

    // Generate Action Items based alerts:
    // TBD

    // set user status fields - dismissed / isNew - for every alerts
    alerts.forEach((alert) => {
      alert.dismissed = dismissedAlertsIds?.includes(alert.id);
      alert.isNew = !lastQueryAlert || lastQueryAlert < alert.date;
    });

    return alerts.sort((a1: Alert, a2: Alert) => {
      return differenceInMilliseconds(a2.date, a1.date);
    });
  }

  notificationDispatchToAlerts(dispatch: Dispatch, member: Member): Alert {
    const alertType = AlertType[dispatch.contentKey];

    if (alertType) {
      return {
        id: dispatch.dispatchId,
        member,
        type: alertType,
        date: new Date(dispatch.sentAt),
      } as Alert;
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/
  private async getMembersForPrimaryUser(userId: string): Promise<Member[]> {
    return this.memberModel.find({ primaryUserId: new Types.ObjectId(userId) });
  }

  private async getUserDismissedAlerts(userId: string): Promise<DismissedAlert[]> {
    return this.dismissAlertModel.find({ userId });
  }

  private calculateAppointments = (
    member: Member,
  ): { appointmentsCount: number; nextAppointment: Date } => {
    const allAppointments = member.users
      .map((user) => user.appointments)
      .reduce((acc = [], current) => acc.concat(current), [])
      .filter(
        (app: Appointment) =>
          app.memberId.toString() === member.id.toString() &&
          app.status !== AppointmentStatus.deleted,
      );

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
