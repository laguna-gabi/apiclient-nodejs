import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserParams, User, UserDocument } from '.';
import { DbErrors, Errors, ErrorType, EventType } from '../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Member } from '../member';
import { cloneDeep } from 'lodash';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async get(id: string): Promise<User> {
    return this.userModel.findById(id).populate('appointments');
  }

  async insert(createUserParams: CreateUserParams): Promise<User> {
    try {
      const newObject = cloneDeep(createUserParams);
      const _id = newObject.id;
      delete newObject.id;

      const object = (await this.userModel.create({ ...newObject, _id })).toObject();

      object.id = object._id;
      delete object._id;
      return object;
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.userIdOrEmailAlreadyExists) : ex,
      );
    }
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
  async collectUsersDataBridge({ member, usersIds }: { member: Member; usersIds: string[] }) {
    const users = await this.userModel.find({ _id: { $in: usersIds.map((user) => user) } });
    this.eventEmitter.emit(EventType.newMember, { member, users });
  }
}
