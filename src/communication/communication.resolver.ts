import { UseInterceptors } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  Logger,
  LoggingInterceptor,
  UpdatedAppointmentAction,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => CommunicationInfo)
export class CommunicationResolver {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly logger: Logger,
  ) {}

  @Query(() => CommunicationInfo, { nullable: true })
  async getCommunication(
    @Args(camelCase(GetCommunicationParams.name))
    getCommunicationParams: GetCommunicationParams,
  ): Promise<CommunicationInfo> {
    const result = await this.communicationService.get(getCommunicationParams);
    if (result) {
      return {
        memberId: result.memberId,
        userId: result.userId,
        chat: {
          memberLink: this.buildUrl({
            uid: result.memberId,
            mid: result.sendbirdChannelUrl,
            token: result.memberToken,
          }),
          userLink: this.buildUrl({
            uid: result.userId,
            mid: result.sendbirdChannelUrl,
            token: result.userToken,
          }),
        },
      };
    } else {
      return null;
    }
  }

  @Query(() => UnreadMessagesCount)
  getMemberUnreadMessagesCount(@Args('memberId', { type: () => String }) memberId: string) {
    return this.communicationService.getMemberUnreadMessagesCount(memberId);
  }

  @Query(() => String)
  getTwilioAccessToken() {
    return this.communicationService.getTwilioAccessToken();
  }

  @OnEvent(EventType.newUser, { async: true })
  async handleNewUser(params: IEventNewUser) {
    await this.communicationService.createUser(params.user);
  }

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember(params: IEventNewMember) {
    await this.communicationService.createMember(params.member);
    await this.communicationService.connectMemberToUser(
      params.member,
      params.user,
      params.platform,
    );
  }

  @OnEvent(EventType.updateMemberPlatform, { async: true })
  async handleUpdateMemberPlatform(params: IEventUpdateMemberPlatform) {
    return this.communicationService.onUpdateMemberPlatform(params);
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
}
