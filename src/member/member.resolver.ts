import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { CreateMemberParams, Member } from './member.schema';
import { Identifier } from '../common';
import { camelCase, remove } from 'lodash';

@Resolver(() => Member)
export class MemberResolver {
  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => Identifier)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    remove(
      createMemberParams.usersIds,
      (i) => i === createMemberParams.primaryCoachId,
    );
    return this.memberService.insert(createMemberParams);
  }

  @Query(() => Member, { nullable: true })
  async getMember(@Args('id', { type: () => String }) id: string) {
    return this.memberService.get(id);
  }
}
