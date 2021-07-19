import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateMemberParams, Member, MemberService } from '.';
import { Identifier } from '../common';
import { camelCase, remove } from 'lodash';
import * as jwt from 'jsonwebtoken';

@Resolver(() => Member)
export class MemberResolver {
  private readonly authenticationPrefix = 'Bearer ';

  constructor(private readonly memberService: MemberService) {}

  @Mutation(() => Identifier)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    remove(createMemberParams.usersIds, (i) => i === createMemberParams.primaryCoachId);
    return this.memberService.insert(createMemberParams);
  }

  @Query(() => Member, { nullable: true })
  async getMember(@Context() context) {
    const authorizationHeader = context.req.headers.authorization.replace(
      this.authenticationPrefix,
      '',
    );
    const authorization = jwt.decode(authorizationHeader);

    return authorization?.username ? this.memberService.get(authorization?.username) : null;
  }
}
