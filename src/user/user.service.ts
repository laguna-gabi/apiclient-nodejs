import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { add, getHours, startOfTomorrow } from 'date-fns';
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
  IEventUpdateUserConfig,
  SlackChannel,
  SlackIcon,
} from '../common';
import { UserConfig, UserConfigDocument } from './userConfig.dto';

@Injectable()
export class UserService extends BaseService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private eventEmitter: EventEmitter2,
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
    const { appointmentId, userId } = getSlotsParams;
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

    slotsObject.slots = this.slotService.getSlots(
      slotsObject.av,
      slotsObject.ap,
      defaultSlotsParams.duration,
      defaultSlotsParams.maxSlots,
      getSlotsParams.notBefore,
    );
    delete slotsObject.ap;
    delete slotsObject.av;
    if (userId) {
      delete slotsObject.member;
      delete slotsObject.appointment;
    }

    if (slotsObject.slots.length === 0) {
      slotsObject.slots = this.generateDefaultSlots();
      const params: IEventSlackMessage = {
        message: `*No availability*\nUser ${userId} to fulfill slots request`,
        icon: SlackIcon.warning,
        channel: SlackChannel.notifications,
      };
      this.eventEmitter.emit(EventType.slackMessage, params);
    }

    return slotsObject;
  }

  generateDefaultSlots() {
    const slots: Date[] = [];
    let nextSlot = add(new Date(), { hours: 2 });
    for (let index = 0; index < 6; index++) {
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
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'users',
          as: 'member',
        },
      },
      ...(process.env.NODE_ENV === Environments.production ||
      process.env.NODE_ENV === Environments.development
        ? []
        : [{ $limit: 10 }]),
      { $project: { members: { $size: '$member' } } },
      { $sort: { members: 1 } },
    ]);
    return users[0]._id;
  }

  @OnEvent(EventType.updateUserConfig, { async: true })
  async handleUpdateUserConfig(params: IEventUpdateUserConfig): Promise<boolean> {
    const { userId, accessToken } = params;
    const result = await this.userConfigModel.updateOne({ userId }, { $set: { accessToken } });

    return result.ok === 1;
  }

  @OnEvent(EventType.newAppointment, { async: true })
  async handleOrderCreatedEvent(params: IEventNewAppointment) {
    await this.userModel.updateOne(
      { _id: params.userId },
      { $push: { appointments: new Types.ObjectId(params.appointmentId) } },
    );
  }
}
