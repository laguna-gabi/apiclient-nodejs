import { Injectable, NotImplementedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 } from 'uuid';
import {
  Communication,
  CommunicationDocument,
  CreateSendbirdGroupChannelParams,
  GetCommunicationParams,
  RegisterSendbirdUserParams,
} from '.';
import { AppointmentStatus } from '../appointment';
import {
  ErrorType,
  Errors,
  EventType,
  IEventUpdateMemberConfig,
  IEventUpdateUserConfig,
  Logger,
  Platform,
  UpdatedAppointmentAction,
} from '../common';
import { Member } from '../member';
import { SendBird, TwilioService } from '../providers';
import { User, UserRole } from '../user';

@Injectable()
export class CommunicationService {
  constructor(
    @InjectModel(Communication.name)
    private readonly communicationModel: Model<CommunicationDocument>,
    private readonly sendBird: SendBird,
    private eventEmitter: EventEmitter2,
    private readonly twilio: TwilioService,
    private readonly logger: Logger,
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
          sendBirdChannelUrl: params.channel_url,
        });
        await this.sendBird.freezeGroupChannel(params.channel_url, platform === Platform.web);
      }
    } catch (ex) {
      this.logger.error(
        { memberId: member.id, userId: user.id },
        CommunicationService.name,
        this.connectMemberToUser.name,
        ex,
      );
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
        params,
        CommunicationService.name,
        this.onUpdatedAppointment.name,
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
      return;
    }

    if (params.updatedAppointmentAction === UpdatedAppointmentAction.edit) {
      await this.sendBird.updateGroupChannelMetadata(
        communication.sendBirdChannelUrl,
        params.key,
        params.value,
      );
    } else if (params.updatedAppointmentAction === UpdatedAppointmentAction.delete) {
      await this.sendBird.deleteGroupChannelMetadata(communication.sendBirdChannelUrl, params.key);
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
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    }
    await this.sendBird.freezeGroupChannel(
      communication.sendBirdChannelUrl,
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
          sendBirdChannelUrl: '$sendBirdChannelUrl',
        },
      },
    ]);
    return result[0];
  }

  async getByChannelUrl(sendBirdChannelUrl: string): Promise<Communication> {
    return this.communicationModel.findOne({ sendBirdChannelUrl });
  }

  async getMemberUserCommunication({
    memberId,
    userId,
  }: {
    memberId: string;
    userId: string;
  }): Promise<Communication> {
    return this.communicationModel.findOne({ memberId: new Types.ObjectId(memberId), userId });
  }

  async getMemberUnreadMessagesCount(memberId: string) {
    const [result] = await this.communicationModel.find({
      memberId: new Types.ObjectId(memberId),
    });
    if (!result) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }
    const count = await this.sendBird.countUnreadMessages(result.sendBirdChannelUrl, memberId);
    return { count, memberId, userId: result.userId };
  }

  async freezeGroupChannel({ memberId, userId }: { memberId: string; userId: string }) {
    this.logger.debug(
      { memberId, userId },
      CommunicationService.name,
      this.freezeGroupChannel.name,
    );
    const [communication] = await this.communicationModel.find({
      memberId: new Types.ObjectId(memberId),
      userId,
    });
    if (!communication) {
      this.logger.warn(
        { memberId, userId },
        CommunicationService.name,
        this.freezeGroupChannel.name,
        Errors.get(ErrorType.communicationMemberUserNotFound),
      );
      return;
    }
    return this.sendBird.freezeGroupChannel(communication.sendBirdChannelUrl, true);
  }

  async deleteCommunication(communication) {
    this.logger.debug(communication, CommunicationService.name, this.deleteCommunication.name);
    await this.communicationModel.deleteOne({
      memberId: communication.memberId,
      userId: communication.userId,
    });
    await this.sendBird.deleteGroupChannel(communication.sendBirdChannelUrl);
    await this.sendBird.deleteUser(communication.memberId.toString());
  }

  getTwilioAccessToken() {
    return this.twilio.getAccessToken();
  }
}
