import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseService } from '../common';
import { Member, MemberDocument } from '../member';
import { User, UserDocument } from '../user';

@Injectable()
export class UserSecurityService extends BaseService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<MemberDocument>,
  ) {
    super();
  }

  async getUserByAuthId(authId: string): Promise<UserDocument> {
    return this.userModel.findOne({ authId });
  }
  async getMemberByAuthId(authId: string): Promise<MemberDocument> {
    return this.memberModel.findOne({ authId });
  }
}
