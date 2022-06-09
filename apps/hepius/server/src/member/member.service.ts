import { Appointment, AppointmentStatus } from '@argus/hepiusClient';
import { formatEx } from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { articlesByDrg, queryDaysLimit } from 'config';
import { cloneDeep, isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import { v4 } from 'uuid';
import { Alert, AlertType, DismissedAlert, DismissedAlertDocument } from '../../src/common';
import {
  AlertService,
  DbErrors,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnNewAppointment,
  IEventOnNewMemberCommunication,
  IEventUpdateHealthPersona,
  LoggerService,
  deleteMemberObjects,
  extractEmbeddedSetObject,
} from '../common';
import { ISoftDelete } from '../db';
import { Internationalization } from '../providers';
import { NotificationService } from '../services';
import {
  AddInsuranceParams,
  AppointmentCompose,
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
  ReplaceMemberOrgParams,
  ReplaceUserForMemberParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
} from './index';

@Injectable()
export class MemberService extends AlertService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument> & ISoftDelete<MemberDocument>,
    @InjectModel(MemberConfig.name)
    private readonly memberConfigModel: Model<MemberConfigDocument> &
      ISoftDelete<MemberConfigDocument>,
    @InjectModel(ControlMember.name)
    private readonly controlMemberModel: Model<ControlMemberDocument>,
    @InjectModel(Insurance.name)
    private readonly insuranceModel: Model<InsuranceDocument> & ISoftDelete<InsuranceDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    private readonly notificationService: NotificationService,
    private readonly internationalization: Internationalization,
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
    const { id } = updateMemberParams;

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
        $lookup: {
          from: 'appointments',
          localField: 'recentJourney._id',
          foreignField: 'journeyId',
          as: 'appointments',
        },
      },
      {
        $project: {
          id: '$_id',
          name: { $concat: ['$firstName', ' ', '$lastName'] },
          phone: '$phone',
          phoneType: '$phoneType',
          dischargeDate: { $ifNull: ['$dischargeDate', undefined] },
          adherence: { $ifNull: ['$recentJourney.scores.adherence', 0] },
          wellbeing: { $ifNull: ['$recentJourney.scores.wellbeing', 0] },
          createdAt: '$createdAt',
          actionItemsCount: { $size: '$actionItems' },
          primaryUserId: '$primaryUserId',
          users: '$users',
          org: '$org',
          platform: '$memberconfig.platform',
          firstLoggedInAt: '$recentJourney.firstLoggedInAt',
          isGraduated: '$recentJourney.isGraduated',
          graduationDate: '$recentJourney.graduationDate',
          appointments: {
            $filter: {
              input: '$appointments',
              as: 'appointments',
              cond: { $eq: ['$$appointments.deleted', false] },
            },
          },
        },
      },
    ]);

    result = await this.memberModel.populate(result, [
      {
        path: 'users',
        options: { populate: 'appointments' },
      },
      { path: 'org' },
    ]);
    return result.map((item) => {
      const { appointmentsCount, nextAppointment } = this.calculateAppointments(item.appointments);
      const [primaryUser] = item.users.filter((user) => user.id === item.primaryUserId.toString());

      delete item.primaryUserId;
      delete item.users;
      delete item._id;

      return { ...item, primaryUser, appointmentsCount, nextAppointment };
    });
  }

  async getMembersAppointments(orgId?: string): Promise<AppointmentCompose[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - queryDaysLimit.getMembersAppointments);

    return this.memberModel.aggregate([
      { $match: orgId ? { org: new Types.ObjectId(orgId) } : {} },
      {
        $lookup: {
          from: 'journeys',
          localField: '_id',
          foreignField: 'memberId',
          as: 'journeys',
        },
      },
      { $addFields: { recentJourney: { $last: '$journeys' } } },
      {
        $lookup: {
          localField: '_id',
          from: 'appointments',
          foreignField: 'memberId',
          as: 'a',
        },
      },
      { $unwind: { path: '$a' } },
      {
        $match: {
          'a.deleted': false,
          'a.start': { $gt: startDate },
          $expr: {
            $eq: [
              {
                $toObjectId: '$a.journeyId',
              },
              {
                $toObjectId: '$recentJourney._id',
              },
            ],
          },
        },
      },
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
          _id: 0,
          memberId: '$_id',
          memberName: { $concat: ['$firstName', ' ', '$lastName'] },
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

  private calculateAppointments = (
    appointments: Appointment[],
  ): { appointmentsCount: number; nextAppointment: Date } => {
    const nextAppointment = appointments
      .filter(
        (appointment) =>
          appointment?.status === AppointmentStatus.scheduled &&
          appointment?.start.getTime() >= Date.now(),
      )
      .sort((appointment1, appointment2) =>
        appointment1.start.getTime() > appointment2.start.getTime() ? 1 : -1,
      )[0]?.start;

    const appointmentsCount = appointments.filter(
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
