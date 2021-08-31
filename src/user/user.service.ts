import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateUserParams,
  NotNullableUserKeys,
  User,
  UserDocument,
  SlotService,
  defaultSlotsParams,
  GetSlotsParams,
  NotNullableSlotsKeys,
  Slots,
} from '.';
import { BaseService, DbErrors, Errors, ErrorType, EventType, Platform } from '../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Member } from '../member';
import { cloneDeep } from 'lodash';
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

    const slots = this.slotService.getSlots(
      slotsObject.av,
      slotsObject.ap,
      defaultSlotsParams.duration,
      defaultSlotsParams.maxSlots,
      getSlotsParams.notBefore,
    );

    slotsObject.slots = slots;
    delete slotsObject.ap;
    delete slotsObject.av;
    if (userId) {
      delete slotsObject.member;
      delete slotsObject.appointment;
    }

    return slotsObject;
  }

  async getUserConfig(userId: string): Promise<UserConfig> {
    const object = await this.userConfigModel.findOne({ userId });
    if (!object) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return object;
  }

  @OnEvent(EventType.updateUserConfig, { async: true })
  async handleupdateUserConfig({
    userId,
    accessToken,
  }: {
    userId: string;
    accessToken: string;
  }): Promise<boolean> {
    const result = await this.userConfigModel.updateOne({ userId }, { $set: { accessToken } });

    return result.ok === 1;
  }

  @OnEvent(EventType.newAppointment, { async: true })
  async handleOrderCreatedEvent({
    userId,
    appointmentId,
  }: {
    userId: string;
    appointmentId: string;
  }) {
    await this.userModel.updateOne(
      { _id: userId },
      { $push: { appointments: new Types.ObjectId(appointmentId) } },
    );
  }

  @OnEvent(EventType.collectUsersDataBridge, { async: true })
  async collectUsersDataBridge({
    member,
    platform,
    usersIds,
  }: {
    member: Member;
    platform: Platform;
    usersIds: string[];
  }) {
    const users = await this.userModel.find({ _id: { $in: usersIds.map((user) => user) } });
    this.eventEmitter.emit(EventType.newMember, { member, users, platform });
  }
}
