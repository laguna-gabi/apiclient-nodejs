import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { MemberService } from './member.service';
import { CreateMemberParams, GetMemberParams, Member } from './member.dto';
import { Id } from '../common';
import { camelCase } from 'lodash';

@Resolver(() => Member)
export class MemberResolver {
  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => Id)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    return this.memberService.insert(createMemberParams);
  }

  //TODO error handing -> no id
  @Query(() => Member, { nullable: true })
  async getMember(
    @Args(camelCase(GetMemberParams.name))
    getMemberParams: GetMemberParams,
  ) {
    return this.memberService.get(getMemberParams);
  }
}
