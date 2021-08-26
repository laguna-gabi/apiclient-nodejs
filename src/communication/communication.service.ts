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
import { SendBird, TwilioService } from '../providers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventType } from '../common';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Communication.name)
    private readonly communicationModel: Model<CommunicationDocument>,
    private readonly sendBird: SendBird,
    private eventEmitter: EventEmitter2,
    private readonly twilio: TwilioService,
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
      issue_access_token: true,
      metadata: { role: UserRole.coach.toLowerCase() },
    };

    const accessToken = await this.sendBird.createUser(params);

    this.eventEmitter.emit(EventType.updateUserConfig, {
      userId: user.id,
      accessToken,
    });
  }

  async createMember(member: Member) {
    const params: RegisterSendbirdUserParams = {
      user_id: member.id,
      nickname: `${member.firstName} ${member.lastName}`,
      profile_url: '',
      issue_access_token: true,
      metadata: {},
    };

    const accessToken = await this.sendBird.createUser(params);

    this.eventEmitter.emit(EventType.updateMemberConfig, {
      memberId: member.id,
      accessToken,
    });
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
        userId: user.id,
        sendbirdChannelUrl,
      });
    }
  }

  async get(params: GetCommunicationParams) {
    const result = await this.communicationModel.aggregate([
      {
        $match: {
          userId: params.userId,
          memberId: new Types.ObjectId(params.memberId),
        },
      },
      {
        $lookup: {
          from: 'memberconfigs',
          localField: 'memberId',
          foreignField: 'memberId',
          as: 'member',
        },
      },
      { $unwind: '$member' },
      {
        $lookup: {
          from: 'userconfigs',
          localField: 'userId',
          foreignField: 'userId',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$userId',
          memberId: '$memberId',
          memberToken: '$member.accessToken',
          userToken: '$user.accessToken',
          sendbirdChannelUrl: '$sendbirdChannelUrl',
        },
      },
    ]);
    return result[0];
  }

  getTwilioAccessToken() {
    return this.twilio.getAccessToken();
  }
}
