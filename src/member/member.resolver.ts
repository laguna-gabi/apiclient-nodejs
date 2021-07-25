import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateMemberParams,
  CreateTaskParams,
  Member,
  MemberService,
  UpdateTaskStateParams,
  TaskState,
} from '.';
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

    const { firstName, lastName } = createMemberParams;
    const dischargeNotesLink = `${firstName}_${lastName}_Summary.pdf`;
    const dischargeInstructionsLink = `${firstName}_${lastName}_Instructions.pdf`;

    return this.memberService.insert({
      createMemberParams,
      dischargeNotesLink,
      dischargeInstructionsLink,
    });
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

  /*************************************************************************************************
   ********************************************* Goals *********************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  async createGoal(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertGoal({ createTaskParams, state: TaskState.pending });
  }

  @Mutation(() => Boolean, { nullable: true })
  async updateGoalState(
    @Args(camelCase(UpdateTaskStateParams.name))
    updateTaskStateParams: UpdateTaskStateParams,
  ) {
    return this.memberService.updateGoalState(updateTaskStateParams);
  }

  /*************************************************************************************************
   ****************************************** Action items *****************************************
   ************************************************************************************************/

  @Mutation(() => Identifier)
  async createActionItem(
    @Args(camelCase(CreateTaskParams.name))
    createTaskParams: CreateTaskParams,
  ) {
    return this.memberService.insertActionItem({
      createTaskParams,
      state: TaskState.pending,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  async updateActionItemState(
    @Args(camelCase(UpdateTaskStateParams.name))
    updateTaskStateParams: UpdateTaskStateParams,
  ) {
    return this.memberService.updateActionItemState(updateTaskStateParams);
  }
}
