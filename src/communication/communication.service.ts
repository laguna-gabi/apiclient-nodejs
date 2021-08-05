import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Communication,
  CommunicationDocument,
  CreateSendbirdGroupChannelParams,
  GetCommunicationParams,
  RegisterSendbirdUserParams,
} from '.';
import { User, UserRole } from '../user';
import { Member } from '../member';
import { v4 } from 'uuid';
import { SendBird } from '../providers';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Communication.name)
    private readonly communicationModel: Model<CommunicationDocument>,
    private readonly sendBird: SendBird,
  ) {}

  /**
   * metadata is required to be 'coach', otherwise chat won't be active
   * https://github.com/LagunaHealth/laguna-chat-v2/blob/develop/src/Home.js#L36
   */
  async createUser(user: User) {
    const params: RegisterSendbirdUserParams = {
      user_id: user.id,
      nickname: `${user.firstName} ${user.lastName}`,
      profile_url: user.avatar,
      metadata: { role: UserRole.coach.toLowerCase() },
    };

    await this.sendBird.createUser(params);
  }

  async createMember(member: Member) {
    const params: RegisterSendbirdUserParams = {
      user_id: member.id,
      nickname: `${member.firstName} ${member.lastName}`,
      profile_url: '',
      metadata: {},
    };

    await this.sendBird.createUser(params);
  }

  async connectMemberToUser(member: Member, user: User) {
    const sendbirdChannelUrl = v4();
    const params: CreateSendbirdGroupChannelParams = {
      name: user.firstName,
      channel_url: sendbirdChannelUrl,
      cover_url: user.avatar,
      inviter_id: user.id,
      user_ids: [member.id.toString(), user.id],
    };

    const result = await this.sendBird.createGroupChannel(params);
    if (result) {
      await this.communicationModel.create({
        memberId: new Types.ObjectId(member.id),
        userId: new Types.ObjectId(user.id),
        sendbirdChannelUrl,
      });
    }
  }

  async get(params: GetCommunicationParams): Promise<Communication | null> {
    return this.communicationModel.findOne({
      userId: new Types.ObjectId(params.userId),
      memberId: new Types.ObjectId(params.memberId),
    });
  }
}
