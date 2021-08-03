import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateMemberParams,
  CreateTaskParams,
  Member,
  MemberService,
  UpdateTaskStateParams,
  TaskState,
  UpdateMemberParams,
  MemberSummary,
  AppointmentCompose,
} from '.';
import { Errors, ErrorType, Identifier } from '../common';
import { camelCase, remove } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { getTimezoneOffset } from 'date-fns-tz';
import { millisecondsInHour } from 'date-fns';
import { lookup } from 'zipcode-to-timezone';

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
    const deviceId = this.extractDeviceId(context);
    const member = await this.memberService.get(deviceId);
    member.utcDelta = this.getTimezoneDeltaFromZipcode(member.zipCode);
    return member;
  }

  @Mutation(() => Member)
  async updateMember(
    @Args(camelCase(UpdateMemberParams.name)) updateMemberParams: UpdateMemberParams,
  ) {
    return this.memberService.update(updateMemberParams);
  }

  @Query(() => [MemberSummary])
  async getMembers(@Args('orgId', { type: () => String, nullable: true }) orgId?: string) {
    return this.memberService.getByOrg(orgId);
  }

  @Query(() => [AppointmentCompose])
  async getMembersAppointments(
    @Args('orgId', { type: () => String, nullable: true }) orgId?: string,
  ) {
    return this.memberService.getMembersAppointments(orgId);
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

  /*************************************************************************************************
   ******************************************** Helpers ********************************************
   ************************************************************************************************/

  private extractDeviceId(@Context() context) {
    const authorizationHeader = context.req?.headers.authorization.replace(
      this.authenticationPrefix,
      '',
    );

    const authorization = jwt.decode(authorizationHeader);

    if (!authorization?.username) {
      throw new Error(Errors.get(ErrorType.memberNotFound));
    }

    return authorization.username;
  }

  private getTimezoneDeltaFromZipcode(zipCode?: string): number | undefined {
    if (zipCode) {
      const timeZone = lookup(zipCode);
      return getTimezoneOffset(timeZone) / millisecondsInHour;
    }
  }
}
