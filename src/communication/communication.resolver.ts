import { Args, Query, Resolver } from '@nestjs/graphql';
import { CommunicationInfo, CommunicationService, GetCommunicationParams } from '.';
import { OnEvent } from '@nestjs/event-emitter';
import { EventType } from '../common';
import { User } from '../user';
import { Member } from '../member';
import { camelCase } from 'lodash';
import * as config from 'config';

@Resolver(() => CommunicationInfo)
export class CommunicationResolver {
  constructor(private readonly communicationService: CommunicationService) {}

  @Query(() => CommunicationInfo, { nullable: true })
  async getCommunication(
    @Args(camelCase(GetCommunicationParams.name))
    getCommunicationParams: GetCommunicationParams,
  ) {
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

  @Query(() => String)
  getTwilioAccessToken() {
    return this.communicationService.getTwilioAccessToken();
  }

  @OnEvent(EventType.newUser, { async: true })
  async handleNewUser({ user }: { user: User }) {
    await this.communicationService.createUser(user);
  }

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember({ member, users }: { member: Member; users: User[] }) {
    await this.communicationService.createMember(member);

    await Promise.all(
      users.map(async (user) => this.communicationService.connectMemberToUser(member, user)),
    );
  }

  private buildUrl({ uid, mid, token }): string {
    return `${config.get('hosts.chat')}/?uid=${uid}&mid=${mid}&token=${token}`;
  }
}
