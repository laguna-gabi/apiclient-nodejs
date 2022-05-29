import { StorageType, formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { articlesByDrg, queryDaysLimit } from 'config';
import { add, sub } from 'date-fns';
import { cloneDeep, isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import { v4 } from 'uuid';
import { Alert, AlertType, DismissedAlert, DismissedAlertDocument } from '../../src/common';
import {
  AddCaregiverParams,
  AddInsuranceParams,
  AppointmentCompose,
  CaregiverDocument,
  ControlMember,
  ControlMemberDocument,
  DeleteMemberParams,
  EmbeddedMemberProperties,
  Insurance,
  InsuranceDocument,
  InternalCreateMemberParams,
  Member,
  MemberConfig,
  MemberConfigDocument,
  MemberDocument,
  MemberSummary,
  NotNullableMemberKeys,
  Recording,
  RecordingDocument,
  RecordingOutput,
  ReplaceMemberOrgParams,
  ReplaceUserForMemberParams,
  UpdateCaregiverParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateRecordingReviewParams,
} from './index';
import { AppointmentDocument } from '../appointment';
import {
  AlertService,
  DbErrors,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnNewAppointment,
  IEventOnNewMemberCommunication,
  IEventOnUpdatedAppointmentScores,
  IEventUnconsentedAppointmentEnded,
  IEventUpdateHealthPersona,
  LoggerService,
  defaultTimestampsDbValues,
  deleteMemberObjects,
  extractEmbeddedSetObject,
} from '../common';
import { ISoftDelete } from '../db';
import { Internationalization, StorageService } from '../providers';
import { Questionnaire, QuestionnaireAlerts, QuestionnaireService } from '../questionnaire';
import { NotificationService } from '../services';
import { Todo, TodoDocument, TodoStatus } from '../todo';
import { Appointment, AppointmentStatus, Caregiver } from '@argus/hepiusClient';

@Injectable()
export class MemberService extends AlertService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument> & ISoftDelete<MemberDocument>,
    @InjectModel(MemberConfig.name)
    private readonly memberConfigModel: Model<MemberConfigDocument> &
      ISoftDelete<MemberConfigDocument>,
    @InjectModel(Recording.name)
    private readonly recordingModel: Model<RecordingDocument> & ISoftDelete<RecordingDocument>,
    @InjectModel(ControlMember.name)
    private readonly controlMemberModel: Model<ControlMemberDocument>,
    @InjectModel(Caregiver.name)
    private readonly caregiverModel: Model<CaregiverDocument> & ISoftDelete<CaregiverDocument>,
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Todo.name)
    private readonly todoModel: Model<TodoDocument & defaultTimestampsDbValues> &
      ISoftDelete<TodoDocument>,
    @InjectModel(Insurance.name)
    private readonly insuranceModel: Model<InsuranceDocument> & ISoftDelete<InsuranceDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    private readonly internationalization: Internationalization,
    private readonly questionnaireService: QuestionnaireService,
    readonly logger: LoggerService,
  ) {
    super(dismissAlertModel);
  }

  async insert(
    params: InternalCreateMemberParams,
    primaryUserId: Types.ObjectId,
  ): Promise<{ member: Member; memberConfig: MemberConfig }> {
    try {
      const { language, ...memberParams } = this.removeNotNullable(params, NotNullableMemberKeys);
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
        member: member.toObject(),
        memberConfig: memberConfig.toObject(),
      };
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.memberPhoneAlreadyExists) : ex,
      );
    }
  }

  async update(updateMemberParams: UpdateMemberParams): Promise<Member> {
    updateMemberParams = this.removeNotNullable(updateMemberParams, NotNullableMemberKeys);
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

    return member;
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
        $lookup: {
          from: 'memberconfigs',
          localField: '_id',
          foreignField: 'memberId',
          as: 'memberconfig',
        },
      },
      { $unwind: { path: '$memberconfig' } },
      {
        $lookup: {
          from: 'journeys',
          localField: '_id',
          foreignField: 'memberId',
          as: 'journeysRes',
        },
      },
      { $addFields: { recentJourney: { $last: '$journeysRes' } } },
      {
        $lookup: {
          from: 'actionitems',
          localField: 'recentJourney._id',
          foreignField: 'journeyId',
          as: 'actionItems',
        },
      },
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
          actionItemsCount: { $size: '$actionItems' },
          primaryUserId: '$primaryUserId',
          users: '$users',
          org: '$org',
          platform: '$memberconfig.platform',
          firstLoggedInAt: '$recentJourney.firstLoggedInAt',
          isGraduated: '$recentJourney.isGraduated',
          graduationDate: '$recentJourney.graduationDate',
        },
      },
    ]);

    result = await this.memberModel.populate(result, [
      { path: 'users', options: { populate: 'appointments' } },
      { path: 'org' },
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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - queryDaysLimit.getMembersAppointments);

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
      { $match: { 'a.deleted': false, 'a.start': { $gt: startDate } } },
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
          status: '$a.status',
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
        { _id: new Types.ObjectId(memberId) },
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
        appointmentId: new Types.ObjectId(appointmentId),
        answered: true,
      });
      const recordingIds = recordingsToDeleteMedia.map((doc) => doc.id);
      if (recordingIds.length >= 1) {
        await Promise.all(
          recordingIds.map(async (recordingId) =>
            this.storageService.deleteFile({
              memberId,
              storageType: StorageType.recordings,
              id: recordingId,
            }),
          ),
        );
      }
      await this.recordingModel.updateMany(
        {
          appointmentId: new Types.ObjectId(appointmentId),
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

  @OnEvent(EventType.onUpdateHealthPersona, { async: true })
  async handleUpdateHealthPersona(params: IEventUpdateHealthPersona) {
    await this.memberModel.findByIdAndUpdate(new Types.ObjectId(params.memberId), {
      $set: { healthPersona: params.healthPersona },
    });
  }

  /*************************************************************************************************
   ******************************************* Delete **********************************************
   ************************************************************************************************/

  async deleteMember(
    params: DeleteMemberParams,
    deletedBy: string,
  ): Promise<{ member: Member; memberConfig: MemberConfig }> {
    this.logger.info(params, MemberService.name, this.deleteMember.name);
    const { id, hard } = params;
    const member = await this.memberModel.findOneWithDeleted({ _id: new Types.ObjectId(id) });
    const memberConfig = await this.memberConfigModel.findOneWithDeleted({
      memberId: new Types.ObjectId(id),
    });
    if (!member || !memberConfig) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    if (hard) {
      await this.hardDeleteMember(member);
    } else {
      await this.softDeleteMember(member, memberConfig, deletedBy);
    }
    await this.deleteMemberRelatedData({ memberId: id, deletedBy, hard });
    return { member, memberConfig };
  }

  private async softDeleteMember(
    member: MemberDocument,
    memberConfig: MemberConfigDocument,
    deletedBy: string,
  ) {
    await member.delete(new Types.ObjectId(deletedBy));
    await memberConfig.delete(new Types.ObjectId(deletedBy));
  }

  private async hardDeleteMember(member: MemberDocument) {
    await this.memberModel.deleteOne({ _id: new Types.ObjectId(member.id) });
    await this.memberConfigModel.deleteOne({ memberId: new Types.ObjectId(member.id) });
  }

  private async deleteMemberRelatedData(params: IEventDeleteMember) {
    const data = {
      params,
      logger: this.logger,
      methodName: this.deleteMemberRelatedData.name,
      serviceName: MemberService.name,
    };

    await deleteMemberObjects<Model<RecordingDocument> & ISoftDelete<RecordingDocument>>({
      model: this.recordingModel,
      ...data,
    });

    await deleteMemberObjects<Model<CaregiverDocument> & ISoftDelete<CaregiverDocument>>({
      model: this.caregiverModel,
      ...data,
    });

    await deleteMemberObjects<Model<InsuranceDocument> & ISoftDelete<InsuranceDocument>>({
      model: this.insuranceModel,
      ...data,
    });
  }

  /************************************************************************************************
   ******************************************** Control *******************************************
   ************************************************************************************************/

  async insertControl(params: InternalCreateMemberParams): Promise<Member> {
    try {
      const primitiveValues = cloneDeep(this.removeNotNullable(params, NotNullableMemberKeys));
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

  async getAllControl(): Promise<ControlMemberDocument[]> {
    return this.controlMemberModel.find().populate({ path: 'org' });
  }

  async getUserMembers({
    primaryUserId,
  }: {
    primaryUserId: string;
  }): Promise<ControlMemberDocument[]> {
    return this.memberModel.find({ primaryUserId: new Types.ObjectId(primaryUserId) });
  }

  async isControlByPhone(phone: string): Promise<boolean> {
    const controlMember = await this.controlMemberModel.findOne({
      $or: [{ phone }, { phoneSecondary: phone }],
    });
    return !isNil(controlMember);
  }

  /*************************************************************************************************
   ********************************************* Scores *********************************************
   ************************************************************************************************/

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

  /************************************************************************************************
   ***************************************** Member Config ****************************************
   ************************************************************************************************/

  async updateMemberConfig(
    updateMemberConfigParams: UpdateMemberConfigParams,
  ): Promise<MemberConfig> {
    const { memberId, ...setParams } = updateMemberConfigParams;

    const memberConfig = await this.memberConfigModel.findOneAndUpdate(
      { memberId: new Types.ObjectId(memberId) },
      { $set: omitBy(setParams, isNil) },
      { new: true },
    );
    if (!memberConfig) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    return memberConfig;
  }

  async getMemberConfig(id: string): Promise<MemberConfig> {
    const memberConfig = await this.memberConfigModel
      .findOne({ memberId: new Types.ObjectId(id) })
      .lean();
    if (!memberConfig) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    memberConfig.articlesPath = await this.getArticlesPath(id);
    return memberConfig;
  }

  @OnEvent(EventType.onNewMemberCommunication, { async: true })
  async handleUpdateMemberConfig(params: IEventOnNewMemberCommunication): Promise<boolean> {
    this.logger.info(params, MemberService.name, this.handleUpdateMemberConfig.name);
    try {
      const result = await this.memberConfigModel.updateOne(
        { memberId: new Types.ObjectId(params.memberId) },
        { $set: { accessToken: params.accessToken } },
      );

      return result.modifiedCount === 1;
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
   ******************************************** Recording ******************************************
   ************************************************************************************************/
  async updateRecording(updateRecordingParams: UpdateRecordingParams, userId): Promise<Recording> {
    const {
      start,
      end,
      memberId,
      id,
      phone,
      answered,
      appointmentId,
      recordingType,
      consent,
      identityVerification,
    } = updateRecordingParams;
    const member = await this.memberModel.findById(memberId, { _id: 1 });
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    const objectMemberId = new Types.ObjectId(memberId);
    const setParams = omitBy(
      {
        memberId: objectMemberId,
        start,
        end,
        userId,
        phone,
        answered,
        recordingType,
        consent,
        identityVerification,
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
      return result.toObject();
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
    return member;
  }

  async replaceMemberOrg(replaceMemberOrgParams: ReplaceMemberOrgParams): Promise<Member> {
    const { memberId, orgId } = replaceMemberOrgParams;

    await this.memberModel.findOneAndUpdate(
      { _id: new Types.ObjectId(memberId) },
      { org: new Types.ObjectId(orgId) },
    );

    const member = await this.getById(memberId);
    if (!member) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return member;
  }

  /*************************************************************************************************
   ******************************************* Caregivers ******************************************
   ************************************************************************************************/

  async addCaregiver(addCaregiverParams: AddCaregiverParams): Promise<Caregiver> {
    return this.caregiverModel.create({
      ...addCaregiverParams,
      memberId: new Types.ObjectId(addCaregiverParams.memberId),
    });
  }

  async deleteCaregiver(id: string, deletedBy: string, hard?: boolean) {
    if (hard) {
      return this.caregiverModel.remove({ _id: new Types.ObjectId(id) });
    } else {
      const caregiver = await this.caregiverModel.findOne({
        _id: new Types.ObjectId(id),
      });
      await caregiver?.delete(new Types.ObjectId(deletedBy));
    }
  }

  async getCaregiver(id: string): Promise<Caregiver> {
    return this.caregiverModel.findOne({ _id: new Types.ObjectId(id) });
  }

  async updateCaregiver(updateCaregiverParams: UpdateCaregiverParams): Promise<Caregiver> {
    return this.caregiverModel.findOneAndUpdate(
      { _id: new Types.ObjectId(updateCaregiverParams.id) },
      {
        $set: {
          ...updateCaregiverParams,
          memberId: new Types.ObjectId(updateCaregiverParams.memberId),
        },
      },
      { upsert: true, new: true },
    );
  }

  async getCaregiversByMemberId(memberId: string): Promise<Caregiver[]> {
    const res = await this.caregiverModel.find({ memberId: new Types.ObjectId(memberId) });
    return res;
  }

  /*************************************************************************************************
   **************************************** Insurance Plans ****************************************
   ************************************************************************************************/

  async addInsurance(addInsuranceParams: AddInsuranceParams): Promise<Insurance> {
    return this.insuranceModel.create({
      ...addInsuranceParams,
      memberId: new Types.ObjectId(addInsuranceParams.memberId),
    });
  }

  async deleteInsurance(id: string, deletedBy: string, hard?: boolean) {
    if (hard) {
      return this.insuranceModel.remove({ _id: new Types.ObjectId(id) });
    } else {
      const insurance = await this.insuranceModel.findOne({
        _id: new Types.ObjectId(id),
      });
      await insurance?.delete(new Types.ObjectId(deletedBy));
    }
  }

  async getInsurance(memberId: string): Promise<Insurance[]> {
    const res = await this.insuranceModel.find({ memberId: new Types.ObjectId(memberId) });
    return res;
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  async entityToAlerts(member: Member): Promise<Alert[]> {
    let alerts: Alert[] = [];

    // collect member alerts (AlertType.memberAssigned)
    alerts = alerts.concat(await this.memberItemToAlerts(member));

    // collect actionItemOverdue alerts
    alerts = alerts.concat(await this.notificationDispatchToAlerts(member));

    // Collect appointment related alerts
    alerts = alerts.concat(await this.appointmentsItemsToAlerts(member));

    // Collect assessment related alerts
    alerts = alerts.concat(await this.questionnaireToAlerts(member));

    // Collect todo alerts
    alerts = alerts.concat(await this.todosItemsToAlerts(member));

    return alerts;
  }

  private async memberItemToAlerts(member: Member): Promise<Alert[]> {
    return [
      {
        id: `${member.id}_${AlertType.memberAssigned}`,
        memberId: member.id,
        type: AlertType.memberAssigned,
        date: member.createdAt,
        text: this.internationalization.getAlerts(AlertType.memberAssigned, { member }),
      } as Alert,
    ];
  }

  private async notificationDispatchToAlerts(member: Member): Promise<Alert[]> {
    const dispatches = await this.notificationService.getDispatchesByClientSenderId(member.id);

    return (
      dispatches
        ?.filter((dispatch) => AlertType[dispatch.contentKey])
        .map(
          (dispatch) =>
            ({
              id: dispatch.dispatchId,
              memberId: member.id,
              type: AlertType[dispatch.contentKey],
              date: new Date(dispatch.sentAt),
              text: this.internationalization.getAlerts(AlertType[dispatch.contentKey], { member }),
            } as Alert),
        ) || []
    );
  }

  private async appointmentsItemsToAlerts(member: Member): Promise<Alert[]> {
    // collect all member recordings
    const recordings = await this.recordingModel.find({
      memberId: new Types.ObjectId(member.id),
      review: { $exists: true },
    });

    // collect all reviewed appointments (push all reviewed appointment ids to an array)
    const reviewAppointmentAlerts = recordings.map((recording) => {
      return {
        id: `${recording.id}_${AlertType.appointmentReviewed}`,
        type: AlertType.appointmentReviewed,
        date: recording.review.createdAt,
        text: this.internationalization.getAlerts(AlertType.appointmentReviewed, {
          member,
        }),
        memberId: member.id,
      } as Alert;
    });

    // grab all `scheduled` (status) appointments where `end` occurred more than 24hrs ago (overdue for submit)
    const appointments = await this.appointmentModel.find({
      memberId: new Types.ObjectId(member.id),
      status: AppointmentStatus.scheduled,
      end: { $lte: sub(new Date(), { days: 1 }) },
    });

    const appointmentSubmitOverdueAlerts = appointments.map((appointment) => {
      return {
        id: `${appointment.id}_${AlertType.appointmentSubmitOverdue}`,
        type: AlertType.appointmentSubmitOverdue,
        date: add(appointment.end, { days: 1 }),
        text: this.internationalization.getAlerts(AlertType.appointmentSubmitOverdue, {
          member,
        }),
        memberId: member.id,
      } as Alert;
    });

    return [reviewAppointmentAlerts, appointmentSubmitOverdueAlerts].flat();
  }

  private async questionnaireToAlerts(member: Member): Promise<Alert[]> {
    const templates = new Map<string, Questionnaire>();
    const qrs = await this.questionnaireService.getQuestionnaireResponseByMemberId(member.id);

    return Promise.all(
      qrs.map(async (qr) => {
        const template =
          templates.get(qr.questionnaireId.toString()) ||
          (await this.questionnaireService.getQuestionnaireById(qr.questionnaireId.toString()));

        templates.set(qr.questionnaireId.toString(), template);

        const results = this.questionnaireService.buildResult(qr.answers, template);

        if (
          results.score >= template.notificationScoreThreshold ||
          (results.alert && QuestionnaireAlerts.get(template.type))
        ) {
          return {
            id: `${qr.id}_${AlertType.assessmentSubmitScoreOverThreshold}`,
            type: AlertType.assessmentSubmitScoreOverThreshold,
            date: qr.createdAt,
            text: this.internationalization.getAlerts(
              AlertType.assessmentSubmitScoreOverThreshold,
              {
                member,
                assessmentName: template.shortName,
                assessmentScore:
                  results.alert && QuestionnaireAlerts.get(template.type)
                    ? QuestionnaireAlerts.get(template.type)
                    : results.score.toString(),
              },
            ),
            memberId: member.id,
          } as Alert;
        }
      }),
    );
  }

  private async todosItemsToAlerts(member: Member): Promise<Alert[]> {
    const todos = await this.todoModel.find({
      memberId: new Types.ObjectId(member.id),
      status: TodoStatus.active,
      relatedTo: { $exists: false },
      createdBy: new Types.ObjectId(member.id),
    });
    return todos.map(
      (todo) =>
        ({
          id: `${todo.id}_${AlertType.memberCreateTodo}`,
          type: AlertType.memberCreateTodo,
          date: todo.createdAt,
          text: this.internationalization.getAlerts(AlertType.memberCreateTodo, {
            member,
            todoText: todo.text,
          }),
          memberId: member.id,
        } as Alert),
    );
  }

  private calculateAppointments = (
    member: Member,
  ): { appointmentsCount: number; nextAppointment: Date } => {
    const allAppointments = member.users
      .map((user) => user.appointments)
      .reduce((acc = [], current) => acc.concat(current), [])
      .filter(
        (app: AppointmentDocument) =>
          app.memberId.toString() === member.id.toString() && !app.get('deleted'),
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

    return this.memberModel
      .findOne({ _id: id })
      .populate({ path: 'org' })
      .populate({ path: 'users', populate: subPopulate });
  }

  private async getArticlesPath(id: string) {
    const { drg } = await this.get(id);
    return articlesByDrg[drg] || articlesByDrg.default;
  }
}
