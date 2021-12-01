import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { add, differenceInDays, getHours, startOfDay } from 'date-fns';
import { cloneDeep } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  CreateUserParams,
  GetSlotsParams,
  NotNullableSlotsKeys,
  NotNullableUserKeys,
  SlotService,
  Slots,
  User,
  UserConfig,
  UserConfigDocument,
  UserDocument,
  defaultSlotsParams,
} from '.';
import {
  BaseService,
  DbErrors,
  Environments,
  ErrorType,
  Errors,
  EventType,
  IEventOnDeletedMemberAppointments,
  IEventOnNewAppointment,
  IEventOnUpdateUserConfig,
  IEventOnUpdatedUserAppointments,
  Logger,
  UserRole,
} from '../common';
import { IEventNotifySlack, SlackChannel, SlackIcon } from '@lagunahealth/pandora';

@Injectable()
export class UserService extends BaseService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private eventEmitter: EventEmitter2,
    readonly logger: Logger,
    private slotService: SlotService,
    @InjectModel(UserConfig.name)
    private readonly userConfigModel: Model<UserConfigDocument>,
  ) {
    super();
  }

  async get(id: string): Promise<User> {
    return this.userModel.findById(id).populate('appointments');
  }

  async getUsers(roles: UserRole[]): Promise<User[]> {
    return this.userModel.find({ roles: { $in: roles } }).populate('appointments');
  }

  async insert(createUserParams: CreateUserParams): Promise<User> {
    try {
      this.removeNotNullable(createUserParams, NotNullableUserKeys);
      const newObject = cloneDeep(createUserParams);

      const object = await this.userModel.create({ ...newObject });

      await this.userConfigModel.create({
        userId: new Types.ObjectId(object._id),
      });

      return this.replaceId(object.toObject());
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.userIdOrEmailAlreadyExists) : ex,
      );
    }
  }

  async getSlots(getSlotsParams: GetSlotsParams): Promise<Slots> {
    this.removeNotNullable(getSlotsParams, NotNullableSlotsKeys);
    const { appointmentId, userId, defaultSlotsCount, allowEmptySlotsResponse, maxSlots } =
      getSlotsParams;

    const [slotsObject] = await this.userModel.aggregate([
      ...(userId
        ? [{ $match: { _id: Types.ObjectId(userId) } }]
        : [
            { $unwind: { path: '$appointments' } },
            { $match: { appointments: new Types.ObjectId(appointmentId) } },
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
          ap: '$ap',
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
        message: `*No availability*\nUser ${
          userId ? userId : slotsObject.appointment.userId
        } doesn't have any availability left.`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(EventType.notifySlack, params);
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
    const object = await this.userConfigModel.findOne({ userId });
    if (!object) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return object;
  }

  /**
   * Internal method for all receiving users who where fully registered -
   * users who have sendbird accessToken in userConfig
   */
  async getRegisteredUsers(roles: UserRole[] = [UserRole.coach, UserRole.nurse]): Promise<User[]> {
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

  /**
   * This method takes a long time to process with a lot of users in the db.
   * As a hot fix for debugging environments(test/localhost),
   * we'll limit the number of lookup results to 10.
   * In production and dev we're NOT limiting the number of results.
   */
  async getAvailableUser(roles: UserRole[] = [UserRole.coach]): Promise<Types.ObjectId> {
    const users = await this.userModel.aggregate([
      {
        $match: {
          maxCustomers: { $ne: 0 },
          roles: { $in: roles },
        },
      },
      { $sort: { lastMemberAssignedAt: 1 } },
      ...(process.env.NODE_ENV === Environments.production ||
      process.env.NODE_ENV === Environments.development
        ? []
        : [{ $limit: 10 }]),
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'primaryUserId',
          as: 'member',
        },
      },
      {
        $project: {
          members: { $size: '$member' },
          lastMemberAssignedAt: '$lastMemberAssignedAt',
          maxCustomers: '$maxCustomers',
        },
      },
    ]);
    for (let index = 0; index < users.length; index++) {
      if (users[index].maxCustomers > users[index].members) {
        await this.userModel.updateOne(
          { _id: users[index]._id },
          { $set: { lastMemberAssignedAt: new Date() } },
        );
        return users[index]._id;
      }
    }
    const params: IEventNotifySlack = {
      message: `*NO AVAILABLE USERS*\nAll users are fully booked.`,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    };
    this.eventEmitter.emit(EventType.notifySlack, params);
    await this.userModel.updateOne(
      { _id: users[0]._id },
      { $set: { lastMemberAssignedAt: new Date() } },
    );
    return users[0]._id;
  }

  @OnEvent(EventType.onUpdatedUserConfig, { async: true })
  async handleUpdateUserConfig(params: IEventOnUpdateUserConfig): Promise<boolean> {
    try {
      const { userId, accessToken } = params;
      const result = await this.userConfigModel.updateOne({ userId }, { $set: { accessToken } });

      return result.ok === 1;
    } catch (ex) {
      this.logger.error(params, UserService.name, this.handleUpdateUserConfig.name, ex);
    }
  }

  @OnEvent(EventType.onNewAppointment, { async: true })
  async addAppointmentToUser(params: IEventOnNewAppointment): Promise<void> {
    try {
      await this.userModel.updateOne(
        { _id: params.userId },
        { $push: { appointments: new Types.ObjectId(params.appointmentId) } },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.addAppointmentToUser.name, ex);
    }
  }

  @OnEvent(EventType.onDeletedMemberAppointments, { async: true })
  async deleteAppointments(params: IEventOnDeletedMemberAppointments): Promise<void> {
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
    const appointmentIds = params.appointments.map((appointment) => Types.ObjectId(appointment.id));

    try {
      await this.userModel.updateOne(
        { _id: Types.ObjectId(params.oldUserId) },
        { $pullAll: { appointments: appointmentIds } },
      );

      await this.userModel.updateOne(
        { _id: Types.ObjectId(params.newUserId) },
        { $addToSet: { appointments: { $each: appointmentIds } } },
        { new: true },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.updateUserAppointments.name, ex);
    }
  }
}
