import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, CreateUserParams } from '.';
import { DbErrors, Errors, ErrorType, Identifier } from '../common';

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
        ex.code === DbErrors.duplicateKey
          ? Errors.get(ErrorType.userEmailAlreadyExists)
          : ex,
      );
    }
  }
}
