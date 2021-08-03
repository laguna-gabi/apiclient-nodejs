import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Communication,
  CommunicationDocument,
  CreateSendbirdGroupChannelParams,
  RegisterSendbirdUserParams,
} from '.';
import { User } from '../user';
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

  async createUser(user: User) {
    const params: RegisterSendbirdUserParams = {
      user_id: user.id,
      nickname: `${user.firstName} ${user.lastName}`,
      profile_url: user.avatar,
      metadata: { roles: user.roles },
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
      user_ids: [member.id, user.id],
    };

    const result = await this.sendBird.createGroupChannel(params);
    if (result) {
      await this.communicationModel.create({
        memberId: member.id,
        userId: user.id,
        sendbirdChannelUrl,
      });
    }
  }
}
