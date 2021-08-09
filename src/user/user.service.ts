import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserParams, User, UserDocument } from '.';
import { BaseService, DbErrors, Errors, ErrorType, EventType } from '../common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Member } from '../member';

@Injectable()
export class UserService extends BaseService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async get(id: string): Promise<User> {
    return this.userModel.findById({ _id: id }).populate('appointments');
  }

  async insert(createUserParams: CreateUserParams): Promise<User> {
    try {
      const object = await this.userModel.create(createUserParams);
      return this.replaceId(object.toObject());
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey ? Errors.get(ErrorType.userEmailAlreadyExists) : ex,
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
