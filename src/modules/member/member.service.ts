import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from './member.schema';

@Injectable()
export class MemberService {
  constructor(
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
  ) {}

  async create(): Promise<Member> {
    return new this.memberModel().save();
  }

  async findAll(): Promise<Member[]> {
    return this.memberModel.find().exec();
  }
}
