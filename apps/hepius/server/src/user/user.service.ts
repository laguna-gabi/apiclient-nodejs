import {
  Environments,
  GlobalEventType,
  IEventNotifySlack,
  Platform,
  SlackChannel,
  SlackIcon,
  formatEx,
} from '@argus/pandora';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { add, differenceInDays, getHours, startOfDay } from 'date-fns';
import { isEmpty, isNil, omitBy } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  CreateUserParams,
  GetSlotsParams,
  NotNullableSlotsKeys,
  NotNullableUserKeys,
  SlotService,
  Slots,
  UpdateUserParams,
  UserConfig,
  UserConfigDocument,
  UserDocument,
  UserStatistics,
  UserSummary,
  defaultSlotsParams,
} from '.';
import {
  BaseService,
  DbErrors,
  ErrorType,
  Errors,
  EventType,
  IEventOnDeletedMemberAppointments,
  IEventOnNewAppointment,
  IEventOnUpdateUserConfig,
  IEventOnUpdatedUserAppointments,
  LoggerService,
} from '../common';
import { User, UserRole } from '@argus/hepiusClient';
import { QuestionnaireType } from '../questionnaire';

@Injectable()
export class UserService extends BaseService {
  constructor(
    private eventEmitter: EventEmitter2,
    readonly logger: LoggerService,
    private slotService: SlotService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserConfig.name)
    private readonly userConfigModel: Model<UserConfigDocument>,
  ) {
    super();
  }

  async get(id: string): Promise<User> {
    return this.userModel.findById(id).populate('appointments');
  }

  async getUsers(orgIds?: string[]): Promise<UserSummary[]> {
    const { journeyIds, memberIds } = await this.getUsersMembersCurrentJourneys();
    const result = await this.userModel.aggregate([
      {
        $match: orgIds ? { orgs: { $in: orgIds.map((orgId) => new Types.ObjectId(orgId)) } } : {},
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'members',
        },
      },
      {
        $lookup: {
          from: 'appointments',
          localField: 'appointments',
          foreignField: '_id',
          as: 'appointments',
        },
      },

      { $addFields: { id: '$_id' } },
      {
        $addFields: {
          currentMembersCount: {
            $size: {
              $filter: {
                input: '$members',
                as: 'members',
                cond: {
                  $in: ['$$members._id', memberIds],
                },
              },
            },
          },
          appointments: {
            $filter: {
              input: '$appointments',
              as: 'appointments',
              cond: {
                $in: ['$$appointments.journeyId', journeyIds],
              },
            },
          },
        },
      },
      { $unset: '_id' },
      { $unset: 'members' },
    ]);

    return result.map((res) => {
      const { appointments, ...rest } = res;
      return {
        ...rest,
        appointments: appointments.map(({ _id, ...app }) => ({ ...app, id: _id })),
      };
    });
  }

  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const [
      { totalGraduatedMembers, totalActiveMembers, totalAppUsingMembers },
      totalEngagedMembers,
      averageNPSScore,
      averageSessionLength,
    ] = await Promise.all([
      this.getTotalMembers(userId),
      this.getTotalEngagedMembers(userId),
      this.getAverageNPSScore(userId),
      this.getAverageSessionLength(userId),
    ]);

    return {
      totalGraduatedMembers,
      totalActiveMembers,
      totalAppUsingMembers,
      totalEngagedMembers,
      averageNPSScore,
      averageSessionLength,
    };
  }

  async insert(createUserParams: CreateUserParams): Promise<User> {
    try {
      const newObject = this.removeNotNullable(createUserParams, NotNullableUserKeys);

      const object = await this.userModel.create({ ...newObject });
      await this.userConfigModel.create({ userId: new Types.ObjectId(object.id) });

      return object.toObject();
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.userIdOrEmailAlreadyExists) : ex,
      );
    }
  }

  async updateAuthIdAndUsername(id: string, authId: string, username: string): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      new Types.ObjectId(id),
      { authId, username },
      { upsert: false, new: true },
    );

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return user.toObject();
  }

  async update(updateUserParams: UpdateUserParams): Promise<User> {
    const { id, ...setParams } = updateUserParams;
    let user;
    if (isEmpty(setParams)) {
      user = await this.userModel.findById(new Types.ObjectId(id));
    } else {
      user = await this.userModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        { $set: omitBy(setParams, isNil) },
        { upsert: false, new: true },
      );
    }

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return user.toObject();
  }

  async delete(id: string) {
    await this.userModel.findByIdAndDelete(id);
  }

  async getSlots(getSlotsParams: GetSlotsParams): Promise<Slots> {
    const { appointmentId, userId, defaultSlotsCount, allowEmptySlotsResponse, maxSlots } =
      this.removeNotNullable(getSlotsParams, NotNullableSlotsKeys);

    const { journeyIds } = await this.getUsersMembersCurrentJourneys();
    const [slotsObject] = await this.userModel.aggregate([
      ...(userId
        ? [
            {
              $match: {
                $and: [
                  { _id: new Types.ObjectId(userId) },
                  getSlotsParams.orgIds
                    ? {
                        orgs: {
                          $in: getSlotsParams.orgIds.map((orgId) => new Types.ObjectId(orgId)),
                        },
                      }
                    : {}, // ACE
                ],
              },
            },
          ]
        : [
            { $unwind: { path: '$appointments' } },
            {
              $match: {
                $and: [
                  { appointments: new Types.ObjectId(appointmentId) },
                  getSlotsParams.orgIds
                    ? {
                        orgs: {
                          $in: getSlotsParams.orgIds.map((orgId) => new Types.ObjectId(orgId)),
                        },
                      }
                    : {}, // ACE
                ],
              },
            },
            {
              $lookup: {
                from: 'appointments',
                localField: 'appointments',
                foreignField: '_id',
                as: 'userAp',
              },
            },
            {
              $lookup: {
                from: 'members',
                localField: 'userAp.memberId',
                foreignField: '_id',
                as: 'me',
              },
            },
          ]),
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'userId',
          as: 'ap',
        },
      },
      {
        $lookup: {
          from: 'availabilities',
          localField: '_id',
          foreignField: 'userId',
          as: 'av',
        },
      },
      {
        $project: {
          _id: 0,
          user: {
            id: '$_id',
            firstName: '$firstName',
            roles: '$roles',
            avatar: '$avatar',
            description: '$description',
          },
          member: {
            id: { $arrayElemAt: ['$me._id', 0] },
            firstName: { $arrayElemAt: ['$me.firstName', 0] },
          },
          appointment: {
            id: { $arrayElemAt: ['$userAp._id', 0] },
            start: { $arrayElemAt: ['$userAp.start', 0] },
            method: { $arrayElemAt: ['$userAp.method', 0] },
            memberId: { $arrayElemAt: ['$userAp.memberId', 0] },
            userId: { $arrayElemAt: ['$userAp.userId', 0] },
            notBefore: { $arrayElemAt: ['$userAp.notBefore', 0] },
            duration: `${defaultSlotsParams.duration}`,
          },
          ap: {
            $filter: {
              input: '$ap',
              as: 'ap',
              cond: {
                $and: [{ $eq: ['$$ap.deleted', false] }, { $in: ['$$ap.journeyId', journeyIds] }],
              },
            },
          },
          availabilities: allowEmptySlotsResponse
            ? {
                $filter: {
                  input: '$av',
                  as: 'availability',
                  cond: { $gte: ['$$availability.end', new Date()] },
                },
              }
            : '$av',
        },
      },
    ]);

    if (!slotsObject) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const notBefore =
      getSlotsParams.notBefore ||
      slotsObject.appointment?.notBefore ||
      slotsObject.appointment?.start;

    slotsObject.slots = this.slotService.getSlots(
      slotsObject.availabilities,
      slotsObject.ap,
      defaultSlotsParams.duration,
      maxSlots || defaultSlotsParams.maxSlots,
      notBefore,
      getSlotsParams.notAfter,
    );
    delete slotsObject.ap;
    delete slotsObject.availabilities;
    if (userId) {
      delete slotsObject.member;
      delete slotsObject.appointment;
    }
    if (slotsObject.slots.length === 0 && !allowEmptySlotsResponse) {
      slotsObject.slots = this.generateDefaultSlots(defaultSlotsCount, notBefore);
      const params: IEventNotifySlack = {
        header: `*No availability left*`,
        message: `For user ${slotsObject.user.firstName}(${
          userId ? userId : slotsObject.appointment.userId
        })`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(GlobalEventType.notifySlack, params);
    }

    return slotsObject;
  }

  generateDefaultSlots(count: number = defaultSlotsParams.defaultSlots, notBefore?: Date): Date[] {
    const slots: Date[] = [];
    const getStartDate = () => {
      const now = new Date();
      return notBefore && differenceInDays(now, notBefore) !== 0
        ? notBefore
        : add(now, { hours: 2 });
    };

    let nextSlot = getStartDate();
    for (let index = 0; index < count; index++) {
      nextSlot = add(nextSlot, { hours: 1 });
      if (getHours(nextSlot) < 17 || getHours(nextSlot) > 23) {
        nextSlot = add(startOfDay(add(nextSlot, { days: 1 })), { hours: 17 });
      }
      slots.push(nextSlot);
    }
    return slots;
  }

  async getUserConfig(userId: string): Promise<UserConfig> {
    const object = await this.userConfigModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!object) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return object;
  }

  async setLatestQueryAlert(userId: string): Promise<User> {
    return this.userModel.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: { lastQueryAlert: new Date() } },
      { new: true },
    );
  }

  /**
   * Internal method for all receiving users who where fully registered -
   * users who have sendbird accessToken in userConfig
   */
  async getRegisteredUsers(
    roles: UserRole[] = [UserRole.lagunaCoach, UserRole.lagunaNurse],
  ): Promise<User[]> {
    return this.userModel.aggregate([
      {
        $lookup: {
          from: 'userconfigs',
          localField: '_id',
          foreignField: 'userId',
          as: 'configs',
        },
      },
      { $match: { configs: { $ne: [] }, roles: { $in: roles } } },
      { $addFields: { configs: { $arrayElemAt: ['$configs', 0] } } },
      { $match: { 'configs.accessToken': { $ne: null } } },
      { $addFields: { id: '$_id' } },
      { $unset: ['_id'] },
      { $project: { configs: 0 } },
    ]);
  }

  async getEscalationGroupUsers(): Promise<User[]> {
    return this.userModel.find({ inEscalationGroup: true });
  }

  /**
   * This method takes a long time to process with a lot of users in the db.
   * As a hot fix for debugging environments(test/localhost),
   * we'll limit the number of lookup results to 10.
   * In production and dev we're NOT limiting the number of results.
   */
  async getAvailableUser(orgId?: string): Promise<Types.ObjectId> {
    const users = await this.userModel.aggregate([
      {
        $match: {
          maxMembers: { $ne: 0 },
          roles: { $in: [UserRole.lagunaCoach] },
          ...(orgId ? { orgs: { $in: [new Types.ObjectId(orgId)] } } : {}),
        },
      },
      { $sort: { lastMemberAssignedAt: 1 } },
      ...(process.env.NODE_ENV === Environments.production ||
      process.env.NODE_ENV === Environments.develop
        ? []
        : [{ $limit: 10 }]),
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'members',
        },
      },
      {
        $lookup: {
          from: 'journeys',
          localField: 'members._id',
          foreignField: 'memberId',
          as: 'members.journeys',
        },
      },
      {
        $project: {
          journeys: {
            $filter: {
              input: '$members.journeys',
              as: 'journeys',
              cond: {
                $eq: ['$$journeys.isGraduated', false],
              },
            },
          },
          lastMemberAssignedAt: '$lastMemberAssignedAt',
          maxMembers: '$maxMembers',
        },
      },
    ]);

    for (let index = 0; index < users.length; index++) {
      const currentMembers = [];
      users[index].journeys.forEach((journey) => {
        if (!currentMembers.some((id) => id.toString() === journey.memberId.toString())) {
          currentMembers.push(journey.memberId);
        }
      });
      if (users[index].maxMembers > currentMembers.length) {
        await this.userModel.updateOne(
          { _id: users[index]._id },
          { $set: { lastMemberAssignedAt: new Date() } },
        );
        return users[index]._id;
      }
    }
    const params: IEventNotifySlack = {
      header: `*No available users*`,
      message: `All users are fully booked`,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    };
    this.eventEmitter.emit(GlobalEventType.notifySlack, params);

    if (users.length === 0) {
      throw new Error(Errors.get(ErrorType.userNoUsersFound));
    }

    await this.userModel.updateOne(
      { _id: users[0]._id },
      { $set: { lastMemberAssignedAt: new Date() } },
    );
    return users[0]._id;
  }

  @OnEvent(EventType.onUpdatedUserConfig, { async: true })
  async handleUpdateUserConfig(params: IEventOnUpdateUserConfig): Promise<boolean> {
    this.logger.info(params, UserService.name, this.handleUpdateUserConfig.name);
    try {
      const { userId, accessToken, voximplantId, voximplantPassword } = params;
      const result = await this.userConfigModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { accessToken, voximplantId, voximplantPassword } },
      );

      return result.modifiedCount === 1;
    } catch (ex) {
      this.logger.error(params, UserService.name, this.handleUpdateUserConfig.name, formatEx(ex));
    }
  }

  @OnEvent(EventType.onNewAppointment, { async: true })
  async addAppointmentToUser(params: IEventOnNewAppointment): Promise<void> {
    this.logger.info(params, UserService.name, this.addAppointmentToUser.name);
    try {
      await this.userModel.updateOne(
        { _id: params.userId },
        { $push: { appointments: new Types.ObjectId(params.appointmentId) } },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.addAppointmentToUser.name, formatEx(ex));
    }
  }

  @OnEvent(EventType.onDeletedMemberAppointments, { async: true })
  async deleteAppointments(params: IEventOnDeletedMemberAppointments): Promise<void> {
    this.logger.info(params, UserService.name, this.deleteAppointments.name);
    const { appointments } = params;
    await Promise.all(
      appointments.map(async (appointment) => {
        await this.userModel.updateOne(
          { appointments: appointment._id },
          { $pull: { appointments: appointment._id } },
        );
      }),
    );
  }

  @OnEvent(EventType.onUpdatedUserAppointments, { async: true })
  async updateUserAppointments(params: IEventOnUpdatedUserAppointments): Promise<void> {
    this.logger.info(params, UserService.name, this.updateUserAppointments.name);
    const appointmentIds = params.appointments.map(
      (appointment) => new Types.ObjectId(appointment.id),
    );

    try {
      await this.userModel.updateOne(
        { _id: new Types.ObjectId(params.oldUserId) },
        { $pullAll: { appointments: appointmentIds } },
      );

      await this.userModel.updateOne(
        { _id: new Types.ObjectId(params.newUserId) },
        { $addToSet: { appointments: { $each: appointmentIds } } },
        { new: true },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.updateUserAppointments.name, formatEx(ex));
    }
  }

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private async getUsersMembersCurrentJourneys(): Promise<{
    journeyIds: Types.ObjectId[];
    memberIds: Types.ObjectId[];
  }> {
    const [result] = await this.userModel.aggregate([
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'members',
        },
      },
      {
        $unwind: { path: '$members' },
      },
      {
        $lookup: {
          from: 'journeys',
          localField: 'members._id',
          foreignField: 'memberId',
          as: 'journeys',
        },
      },
      {
        $addFields: { recentJourney: { $last: '$journeys' } },
      },
      {
        $match: { 'recentJourney.isGraduated': false },
      },
      {
        $group: {
          _id: '',
          journeyIds: { $push: '$recentJourney._id' },
          memberIds: { $push: '$recentJourney.memberId' },
        },
      },
    ]);

    return {
      journeyIds: result?.journeyIds ? result.journeyIds : [],
      memberIds: result?.memberIds ? result.memberIds : [],
    };
  }

  private async getTotalMembers(userId: string): Promise<{
    totalGraduatedMembers: number;
    totalActiveMembers: number;
    totalAppUsingMembers: number;
  }> {
    const [
      {
        graduated: totalGraduatedMembers,
        notGraduated: totalActiveMembers,
        appUsingMember: totalAppUsingMembers,
      },
    ] = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'members',
        },
      },
      {
        $unwind: {
          path: '$members',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'memberconfigs',
          localField: 'members._id',
          foreignField: 'memberId',
          as: 'memberConfig',
        },
      },
      {
        $unwind: {
          path: '$memberConfig',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'journeys',
          localField: 'members._id',
          foreignField: 'memberId',
          as: 'journeysRes',
        },
      },
      {
        $addFields: {
          recentJourney: {
            $last: '$journeysRes',
          },
        },
      },
      {
        $unset: 'journeysRes',
      },
      {
        $project: {
          graduated: {
            $cond: [{ $eq: ['$recentJourney.isGraduated', true] }, 1, 0],
          },
          notGraduated: {
            $cond: [{ $eq: ['$recentJourney.isGraduated', false] }, 1, 0],
          },
          appUsingMember: {
            $cond: [
              {
                $in: [
                  '$memberConfig.platform',
                  [Platform.android.toString(), Platform.ios.toString()],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          graduated: {
            $sum: '$graduated',
          },
          notGraduated: {
            $sum: '$notGraduated',
          },
          appUsingMember: {
            $sum: '$appUsingMember',
          },
        },
      },
    ]);

    return {
      totalGraduatedMembers,
      totalActiveMembers,
      totalAppUsingMembers,
    };
  }

  private async getTotalEngagedMembers(userId: string): Promise<number> {
    const res = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'member',
        },
      },
      {
        $unwind: {
          path: '$member',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'recordings',
          localField: 'member._id',
          foreignField: 'memberId',
          as: 'recording',
        },
      },
      {
        $unwind: {
          path: '$recording',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $and: [{ 'recording.start': { $exists: true } }, { 'recording.end': { $exists: true } }],
        },
      },
      {
        $addFields: {
          duration: {
            $dateDiff: { startDate: '$recording.start', endDate: '$recording.end', unit: 'second' },
          },
        },
      },
      {
        $group: { _id: '$member._id', maxMemberDuration: { $max: '$duration' } },
      },
      {
        $match: {
          maxMemberDuration: { $gte: 300 },
        },
      },
    ]);
    return res.length;
  }

  private async getAverageNPSScore(userId: string): Promise<number> {
    const [res] = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'member',
        },
      },
      {
        $unwind: {
          path: '$member',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'questionnaireresponses',
          localField: 'member._id',
          foreignField: 'memberId',
          as: 'questionnaireresponse',
        },
      },
      {
        $unwind: {
          path: '$questionnaireresponse',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'questionnaires',
          localField: 'questionnaireresponse.questionnaireId',
          foreignField: '_id',
          as: 'questionnaireresponse.questionnaire',
        },
      },
      {
        $unwind: {
          path: '$questionnaireresponse.questionnaire',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          'questionnaireresponse.questionnaire.type': QuestionnaireType.nps.toString(),
        },
      },
      {
        $project: { npsAnswer: { $arrayElemAt: ['$questionnaireresponse.answers', 0] } },
      },
      {
        $addFields: { npsAnswerValue: { $toInt: '$npsAnswer.value' } },
      },
      {
        $group: {
          _id: null,
          totalNpsAverage: {
            $avg: '$npsAnswerValue',
          },
        },
      },
    ]);

    return Math.round((res?.totalNpsAverage || 0) * 100) / 100;
  }

  private async getAverageSessionLength(userId: string): Promise<number> {
    const [res] = await this.userModel.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'member',
        },
      },
      {
        $unwind: {
          path: '$member',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'recordings',
          localField: 'member._id',
          foreignField: 'memberId',
          as: 'recording',
        },
      },
      {
        $unwind: {
          path: '$recording',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          $and: [{ 'recording.start': { $exists: true } }, { 'recording.end': { $exists: true } }],
        },
      },
      {
        $addFields: {
          duration: {
            $dateDiff: { startDate: '$recording.start', endDate: '$recording.end', unit: 'second' },
          },
        },
      },
      {
        $group: {
          _id: null,
          averageSessionLength: {
            $avg: '$duration',
          },
        },
      },
    ]);

    return Math.round((res?.averageSessionLength || 0) * 100) / 100;
  }
}
