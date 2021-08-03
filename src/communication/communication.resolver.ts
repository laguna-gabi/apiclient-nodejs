import { Resolver } from '@nestjs/graphql';
import { CommunicationService } from '.';
import { OnEvent } from '@nestjs/event-emitter';
import { EventType } from '../common';
import { User } from '../user';
import { Member } from '../member';

@Resolver()
export class CommunicationResolver {
  constructor(private readonly communicationService: CommunicationService) {}

  @OnEvent(EventType.newUser, { async: true })
  async handleNewUser({ user }: { user: User }) {
    await this.communicationService.createUser(user);
  }

  @OnEvent(EventType.newMember, { async: true })
  async handleNewMember({
    member,
    primaryCoach,
    users,
  }: {
    member: Member;
    primaryCoach: User;
    users: User[];
  }) {
    await this.communicationService.createMember(member);

    await this.communicationService.connectMemberToUser(member, primaryCoach);

    await Promise.all(
      users.map(async (user) => this.communicationService.connectMemberToUser(member, user)),
    );
  }
}
