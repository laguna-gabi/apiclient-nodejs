import { Injectable, NotImplementedException } from '@nestjs/common';
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
import {
  EventType,
  IEventUpdateMemberConfig,
  IEventUpdateUserConfig,
  Logger,
  Platform,
  UpdatedAppointmentAction,
} from '../common';
import { AppointmentStatus } from '../appointment';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

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

    const eventParams: IEventUpdateUserConfig = { userId: user.id, accessToken };
    this.eventEmitter.emit(EventType.updateUserConfig, eventParams);
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

    const eventParams: IEventUpdateMemberConfig = { memberId: member.id, accessToken };
    this.eventEmitter.emit(EventType.updateMemberConfig, eventParams);
  }

  async connectMemberToUser(member: Member, user: User, platform: Platform) {
    const params: CreateSendbirdGroupChannelParams = {
      name: user.firstName,
      channel_url: v4(),
      cover_url: user.avatar,
      inviter_id: user.id,
      user_ids: [member.id.toString(), user.id],
    };

    try {
      const result = await this.sendBird.createGroupChannel(params);
      if (result) {
        await this.communicationModel.create({
          memberId: new Types.ObjectId(member.id),
          userId: user.id,
          sendbirdChannelUrl: params.channel_url,
        });
        await this.sendBird.freezeGroupChannel(params.channel_url, platform === Platform.web);
      }
    } catch (ex) {
      this.logger.error(ex, this.connectMemberToUser.name);
    }
  }

  async onUpdatedAppointment(params: {
    memberId: string;
    userId: string;
    key: string;
    value?: { status: AppointmentStatus; start: Date };
    updatedAppointmentAction: UpdatedAppointmentAction;
  }) {
    const communication = await this.get({ memberId: params.memberId, userId: params.userId });
    if (!communication) {
      this.logger.warn(
        'NOT updating sendbird appointment metadata since no member-user communication exists',
        this.onUpdatedAppointment.name,
      );
      return;
    }

    if (params.updatedAppointmentAction === UpdatedAppointmentAction.edit) {
      await this.sendBird.updateGroupChannelMetadata(
        communication.sendbirdChannelUrl,
        params.key,
        params.value,
      );
    } else if (params.updatedAppointmentAction === UpdatedAppointmentAction.delete) {
      await this.sendBird.deleteGroupChannelMetadata(communication.sendbirdChannelUrl, params.key);
    } else {
      throw new NotImplementedException();
    }
  }

  async onUpdateMemberPlatform({
    memberId,
    userId,
    platform,
  }: {
    memberId: string;
    userId: string;
    platform: Platform;
  }) {
    const communication = await this.get({ memberId, userId });
    if (!communication) {
      this.logger.warn(
        'NOT freezing group channel since no member-user communication exists',
        this.onUpdateMemberPlatform.name,
      );
      return;
    }
    await this.sendBird.freezeGroupChannel(
      communication.sendbirdChannelUrl,
      platform === Platform.web,
    );
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
