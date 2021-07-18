import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserParams, User, UserDocument } from '.';
import { DbErrors, Errors, ErrorType, Identifier, EventType } from '../common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async get(id: string): Promise<User> {
    return this.userModel.findById({ _id: id }).populate('appointments');
  }

  async insert(createUserParams: CreateUserParams): Promise<Identifier> {
    try {
      const { _id } = await this.userModel.create(createUserParams);
      return { id: _id };
    } catch (ex) {
      throw new Error(
        ex.code === DbErrors.duplicateKey
          ? Errors.get(ErrorType.userEmailAlreadyExists)
          : ex,
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
}
