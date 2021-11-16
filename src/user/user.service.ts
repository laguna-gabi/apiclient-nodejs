import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { add, differenceInDays, getHours, startOfDay, startOfTomorrow } from 'date-fns';
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
  IEventNewAppointment,
  IEventSlackMessage,
  IEventUpdateAppointmentsInUser,
  IEventUpdateUserConfig,
  Logger,
  SlackChannel,
  SlackIcon,
} from '../common';

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

  async getUsers(): Promise<User[]> {
    return this.userModel.find().populate('appointments');
  }

  async insert(createUserParams: CreateUserParams): Promise<User> {
    try {
      this.removeNotNullable(createUserParams, NotNullableUserKeys);
      const newObject = cloneDeep(createUserParams);
      const _id = newObject.id;
      delete newObject.id;

      const object = (await this.userModel.create({ ...newObject, _id })).toObject();

      await this.userConfigModel.create({
        userId: object._id,
      });

      object.id = object._id;
      delete object._id;
      return object;
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
        ? [
            {
              $match: {
                _id: userId,
              },
            },
          ]
        : [
            {
              $unwind: {
                path: '$appointments',
              },
            },
            {
              $match: {
                appointments: new Types.ObjectId(appointmentId),
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
          ap: '$ap',
          av: '$av',
        },
      },
    ]);

    if (!slotsObject) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    const notBefore = getSlotsParams.notBefore || slotsObject.ap?.[0].notBefore;

    slotsObject.slots = this.slotService.getSlots(
      slotsObject.av,
      slotsObject.ap,
      defaultSlotsParams.duration,
      maxSlots || defaultSlotsParams.maxSlots,
      notBefore,
      getSlotsParams.notAfter,
    );
    delete slotsObject.ap;
    delete slotsObject.av;
    if (userId) {
      delete slotsObject.member;
      delete slotsObject.appointment;
    }

    if (slotsObject.slots.length === 0 && !allowEmptySlotsResponse) {
      slotsObject.slots = this.generateDefaultSlots(defaultSlotsCount, notBefore);
      const params: IEventSlackMessage = {
        message: `*No availability*\nUser ${
          userId ? userId : slotsObject.appointment.userId
        } doesn't have any availability left.`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(EventType.slackMessage, params);
    }

    return slotsObject;
  }

  generateDefaultSlots(count: number = defaultSlotsParams.defaultSlots, notBefore?: Date) {
    const slots: Date[] = [];
    const getStartDate = () => {
      const now = new Date();
      return notBefore && differenceInDays(now, notBefore) !== 0
        ? add(startOfDay(notBefore), { hours: 2 })
        : add(now, { hours: 2 });
    };

    let nextSlot = getStartDate();
    for (let index = 0; index < count; index++) {
      nextSlot = add(nextSlot, { hours: 1 });
      if (getHours(nextSlot) < 17 || getHours(nextSlot) > 23) {
        nextSlot = add(startOfTomorrow(), { hours: 17 });
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
  async getRegisteredUsers(): Promise<User[]> {
    return this.userModel.aggregate([
      {
        $lookup: {
          from: 'userconfigs',
          localField: '_id',
          foreignField: 'userId',
          as: 'configs',
        },
      },
      { $match: { configs: { $ne: [] } } },
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
  async getAvailableUser(): Promise<string> {
    const users = await this.userModel.aggregate([
      {
        $match: {
          maxCustomers: { $ne: 0 }, // users with maxCustomers = 0 should not get members
        },
      },
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
      { $sort: { lastMemberAssignedAt: 1 } },
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
    const params: IEventSlackMessage = {
      message: `*NO AVAILABLE USERS*\nAll users are fully booked.`,
      icon: SlackIcon.warning,
      channel: SlackChannel.notifications,
    };
    this.eventEmitter.emit(EventType.slackMessage, params);
    await this.userModel.updateOne(
      { _id: users[0]._id },
      { $set: { lastMemberAssignedAt: new Date() } },
    );
    return users[0]._id;
  }

  @OnEvent(EventType.updateUserConfig, { async: true })
  async handleUpdateUserConfig(params: IEventUpdateUserConfig): Promise<boolean> {
    try {
      const { userId, accessToken } = params;
      const result = await this.userConfigModel.updateOne({ userId }, { $set: { accessToken } });

      return result.ok === 1;
    } catch (ex) {
      this.logger.error(params, UserService.name, this.handleUpdateUserConfig.name, ex);
    }
  }

  @OnEvent(EventType.newAppointment, { async: true })
  async handleOrderCreatedEvent(params: IEventNewAppointment) {
    try {
      await this.userModel.updateOne(
        { _id: params.userId },
        { $push: { appointments: new Types.ObjectId(params.appointmentId) } },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.handleOrderCreatedEvent.name, ex);
    }
  }

  @OnEvent(EventType.removeAppointmentsFromUser, { async: true })
  async removeAppointmentsFromUser(appointments) {
    await Promise.all(
      appointments.map(async (appointment) => {
        await this.userModel.updateOne(
          { appointments: appointment._id },
          { $pull: { appointments: appointment._id } },
        );
      }),
    );
  }

  @OnEvent(EventType.updateAppointmentsInUser, { async: true })
  async updateUserAppointments(params: IEventUpdateAppointmentsInUser) {
    const appointmentIds = params.appointments.map((appointment) => Types.ObjectId(appointment.id));

    try {
      await this.userModel.updateOne(
        { _id: params.oldUserId },
        { $pullAll: { appointments: appointmentIds } },
      );

      await this.userModel.updateOne(
        { _id: params.newUserId },
        { $addToSet: { appointments: { $each: appointmentIds } } },
        { new: true },
      );
    } catch (ex) {
      this.logger.error(params, UserService.name, this.updateUserAppointments.name, ex);
    }
  }
}
