import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Args, Query, Resolver } from '@nestjs/graphql';
import * as config from 'config';
import { camelCase } from 'lodash';
import {
  CommunicationInfo,
  CommunicationService,
  GetCommunicationParams,
  UnreadMessagesCount,
} from '.';
import { AppointmentStatus } from '../appointment';
import {
  EventType,
  IEventNewMember,
  IEventNewUser,
  IEventUpdateMemberPlatform,
  IEventUpdateUserInAppointments,
  IEventUpdateUserInCommunication,
  Logger,
  LoggingInterceptor,
  RoleTypes,
  Roles,
  UpdatedAppointmentAction,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => CommunicationInfo)
export class CommunicationResolver {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly logger: Logger,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Query(() => CommunicationInfo, { nullable: true })
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
  @Roles(RoleTypes.Member, RoleTypes.User)
  getMemberUnreadMessagesCount(@Args('memberId', { type: () => String }) memberId: string) {
    return this.communicationService.getMemberUnreadMessagesCount(memberId);
  }

  @Query(() => String)
  getTwilioAccessToken() {
    return this.communicationService.getTwilioAccessToken();
  }

  @OnEvent(EventType.newUser, { async: true })
  async handleNewUser(params: IEventNewUser) {
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

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember(params: IEventNewMember) {
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

  @OnEvent(EventType.updateMemberPlatform, { async: true })
  async handleUpdateMemberPlatform(params: IEventUpdateMemberPlatform) {
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

  @OnEvent(EventType.updatedAppointment, { async: true })
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

  @OnEvent(EventType.updateUserInCommunication, { async: true })
  async updateUserInCommunication(params: IEventUpdateUserInCommunication) {
    try {
      await this.communicationService.updateUserInCommunication(params);
      const replacedUserInCommunicationParams: IEventUpdateUserInAppointments = {
        oldUserId: params.oldUserId,
        newUserId: params.newUser.id,
        memberId: params.memberId,
      };
      this.eventEmitter.emit(EventType.updateUserInAppointments, replacedUserInCommunicationParams);
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
