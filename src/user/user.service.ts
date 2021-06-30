import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, CreateUserParams } from './user.schema';
import { Errors, Identifier } from '../common';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async get(id: string): Promise<User> {
    return this.userModel.findById({ _id: id });
  }

  async insert(createUserParams: CreateUserParams): Promise<Identifier> {
    try {
      const { _id } = await this.userModel.create(createUserParams);
      return { id: _id };
    } catch (ex) {
      throw new Error(
        ex.code === 11000
          ? `${Errors.user.create.title} : ${Errors.user.create.reasons.email}`
          : ex,
      );
    }
  }
}
