import { Inject, UseInterceptors, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { hosts } from 'config';
import { camelCase } from 'lodash';
import {
  CommunicationInfo,
  CommunicationService,
  GetCommunicationParams,
  MemberCommunicationInfo,
  UnreadMessagesCount,
} from '.';
import { AppointmentStatus } from '../appointment';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventOnNewMember,
  IEventOnNewUser,
  IEventOnReplacedUserForMember,
  IEventOnUpdatedMemberPlatform,
  IEventOnUpdatedUserCommunication,
  LoggerService,
  LoggingInterceptor,
  MemberRole,
  Roles,
  UpdatedAppointmentAction,
  UserRole,
} from '../common';
import { UserService } from '../user';
import { formatEx } from '@argus/pandora';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => CommunicationInfo)
export class CommunicationResolver {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Query(() => CommunicationInfo, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getCommunication(
    @Args(camelCase(GetCommunicationParams.name))
    getCommunicationParams: GetCommunicationParams,
  ): Promise<CommunicationInfo> {
    const result = await this.communicationService.get(getCommunicationParams);
    try {
      if (result) {
        return {
          memberId: result.memberId,
          userId: result.userId,
          chat: {
            memberLink: CommunicationResolver.buildUrl({
              uid: result.memberId,
              mid: result.sendBirdChannelUrl,
              token: result.memberToken,
            }),
            userLink: CommunicationResolver.buildUrl({
              uid: result.userId,
              mid: result.sendBirdChannelUrl,
              token: result.userToken,
            }),
          },
        };
      } else {
        return null;
      }
    } catch (ex) {
      this.logger.error(
        getCommunicationParams,
        CommunicationResolver.name,
        this.getCommunication.name,
        formatEx(ex),
      );
    }
  }

  @Query(() => UnreadMessagesCount)
  @Roles(MemberRole.member)
  getMemberUnreadMessagesCount(@Client('roles') roles, @Client('_id') memberId) {
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    // ignoring the id from the params - replacing it with the id from the context
    return this.communicationService.getParticipantUnreadMessagesCount(memberId);
  }

  @Query(() => MemberCommunicationInfo)
  @Roles(MemberRole.member)
  async getMemberCommunicationInfo(
    @Client('roles') roles,
    @Client('_id') memberId,
    @Client('primaryUserId') primaryUserId,
  ) {
    // we expect the logged in user to be a member and admin is also implicitly allowed here
    if (!roles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.memberAllowedOnly));
    }
    const communication = await this.communicationService.get({
      memberId,
      userId: primaryUserId,
    });

    const user = await this.userService.get(primaryUserId);

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    if (!communication) {
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    }

    return {
      memberLink: CommunicationResolver.buildUrl({
        uid: communication.memberId,
        mid: communication.sendBirdChannelUrl,
        token: communication.memberToken,
      }),
      user: {
        lastName: user.lastName,
        firstName: user.firstName,
        id: user.id,
        roles: user.roles,
        avatar: user.avatar,
      },
    };
  }

  @Query(() => String)
  @Roles(UserRole.coach, UserRole.nurse)
  getTwilioAccessToken() {
    return this.communicationService.getTwilioAccessToken();
  }

  @OnEvent(EventType.onNewUser, { async: true })
  async handleNewUser(params: IEventOnNewUser) {
    this.logger.info(params, CommunicationResolver.name, this.handleNewUser.name);
    try {
      await this.communicationService.createUser(params.user);
    } catch (ex) {
      this.logger.error(
        { userId: params.user.id },
        CommunicationResolver.name,
        this.handleNewUser.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async handleNewMember(params: IEventOnNewMember) {
    this.logger.info(params, CommunicationResolver.name, this.handleNewMember.name);
    try {
      await this.communicationService.createMember(params.member);
      await this.communicationService.connectMemberToUser(
        params.member,
        params.user,
        params.platform,
      );
    } catch (ex) {
      this.logger.error(
        { memberId: params.member.id, userId: params.user.id },
        CommunicationResolver.name,
        this.handleNewMember.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onUpdatedMemberPlatform, { async: true })
  async handleUpdateMemberPlatform(params: IEventOnUpdatedMemberPlatform) {
    this.logger.info(params, CommunicationResolver.name, this.handleUpdateMemberPlatform.name);
    try {
      return await this.communicationService.onUpdateMemberPlatform(params);
    } catch (ex) {
      this.logger.error(
        params,
        CommunicationResolver.name,
        this.handleUpdateMemberPlatform.name,
        formatEx(ex),
      );
    }
  }

  @OnEvent(EventType.onUpdatedAppointment, { async: true })
  async handleUpdatedAppointment(params: {
    memberId: string;
    userId: string;
    key: string;
    value?: { status: AppointmentStatus; start: Date };
    updatedAppointmentAction: UpdatedAppointmentAction;
  }) {
    this.logger.info(params, CommunicationResolver.name, this.handleUpdatedAppointment.name);
    try {
      return this.communicationService.onUpdatedAppointment(params);
    } catch (ex) {
      this.logger.error(
        params,
        CommunicationResolver.name,
        this.handleUpdatedAppointment.name,
        formatEx(ex),
      );
    }
  }

  private static buildUrl({ uid, mid, token }): string {
    return `${hosts.chat}/?uid=${uid}&mid=${mid}&token=${token}`;
  }

  @OnEvent(EventType.onReplacedUserForMember, { async: true })
  async updateUserInCommunication(params: IEventOnReplacedUserForMember) {
    this.logger.info(params, CommunicationResolver.name, this.updateUserInCommunication.name);
    try {
      await this.communicationService.updateUserInCommunication(params);
      const eventParams: IEventOnUpdatedUserCommunication = {
        oldUserId: params.oldUserId,
        newUserId: params.newUser.id,
        memberId: params.member.id,
      };
      this.eventEmitter.emit(EventType.onUpdatedUserCommunication, eventParams);
      this.logger.info(params, CommunicationResolver.name, this.updateUserInCommunication.name);
    } catch (ex) {
      this.logger.error(
        params,
        CommunicationResolver.name,
        this.updateUserInCommunication.name,
        formatEx(ex),
      );
    }
  }
}
