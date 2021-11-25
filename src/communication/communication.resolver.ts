import { Inject, UseInterceptors, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
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
  ErrorType,
  Errors,
  EventType,
  IEventOnNewMember,
  IEventOnNewUser,
  IEventOnReplacedUserForMember,
  IEventOnUpdatedMemberPlatform,
  IEventOnUpdatedUserCommunication,
  Logger,
  LoggingInterceptor,
  MemberRole,
  Roles,
  UpdatedAppointmentAction,
  UserRole,
} from '../common';
import { UserService } from '../user';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => CommunicationInfo)
export class CommunicationResolver {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly logger: Logger,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Query(() => CommunicationInfo, { nullable: true })
  @Roles(UserRole.coach)
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
            memberLink: this.buildUrl({
              uid: result.memberId,
              mid: result.sendBirdChannelUrl,
              token: result.memberToken,
            }),
            userLink: this.buildUrl({
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
        ex,
      );
    }
  }

  @Query(() => UnreadMessagesCount)
  @Roles(MemberRole.member, UserRole.coach)
  getMemberUnreadMessagesCount(@Args('memberId', { type: () => String }) memberId: string) {
    return this.communicationService.getParticipantUnreadMessagesCount(memberId);
  }

  @Query(() => MemberCommunicationInfo)
  @Roles(MemberRole.member)
  async getMemberCommunicationInfo(@Context() context) {
    const userRoles = context.req?.user.roles;
    // we expect the logged in user to be a member and admin is also implicitly allowed here
    if (!userRoles.includes(MemberRole.member)) {
      throw new Error(Errors.get(ErrorType.communicationInfoIsNotAllowed));
    }

    const memberId = context.req?.user._id.toString();
    const userId = context.req?.user.primaryUserId;
    const communication = await this.communicationService.get({ memberId, userId });

    const user = await this.userService.get(userId);

    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    if (!communication) {
      throw new Error(Errors.get(ErrorType.communicationMemberUserNotFound));
    }

    return {
      memberLink: this.buildUrl({
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
  @Roles(UserRole.coach)
  getTwilioAccessToken() {
    return this.communicationService.getTwilioAccessToken();
  }

  @OnEvent(EventType.onNewUser, { async: true })
  async handleNewUser(params: IEventOnNewUser) {
    try {
      await this.communicationService.createUser(params.user);
    } catch (ex) {
      this.logger.error(
        { userId: params.user.id },
        CommunicationResolver.name,
        this.handleNewUser.name,
        ex,
      );
    }
  }

  @OnEvent(EventType.onNewMember, { async: true })
  async handleNewMember(params: IEventOnNewMember) {
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
        ex,
      );
    }
  }

  @OnEvent(EventType.onUpdatedMemberPlatform, { async: true })
  async handleUpdateMemberPlatform(params: IEventOnUpdatedMemberPlatform) {
    try {
      return await this.communicationService.onUpdateMemberPlatform(params);
    } catch (ex) {
      this.logger.error(
        params,
        CommunicationResolver.name,
        this.handleUpdateMemberPlatform.name,
        ex,
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
    try {
      return this.communicationService.onUpdatedAppointment(params);
    } catch (ex) {
      this.logger.error(params, CommunicationResolver.name, this.handleUpdatedAppointment.name, ex);
    }
  }

  private buildUrl({ uid, mid, token }): string {
    return `${config.get('hosts.chat')}/?uid=${uid}&mid=${mid}&token=${token}`;
  }

  @OnEvent(EventType.onReplacedUserForMember, { async: true })
  async updateUserInCommunication(params: IEventOnReplacedUserForMember) {
    try {
      await this.communicationService.updateUserInCommunication(params);
      const eventParams: IEventOnUpdatedUserCommunication = {
        oldUserId: params.oldUserId,
        newUserId: params.newUser.id,
        memberId: params.member.id,
      };
      this.eventEmitter.emit(EventType.onUpdatedUserCommunication, eventParams);
      this.logger.debug(params, CommunicationResolver.name, this.updateUserInCommunication.name);
    } catch (ex) {
      this.logger.error(
        params,
        CommunicationResolver.name,
        this.updateUserInCommunication.name,
        ex,
      );
    }
  }
}
