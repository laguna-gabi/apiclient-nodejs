import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  Member,
  MemberService,
  MemberSummary,
  TaskState,
  UpdateMemberParams,
  UpdateTaskStateParams,
} from '.';
import { Errors, ErrorType, EventType, Identifier } from '../common';
import { camelCase, remove } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { getTimezoneOffset } from 'date-fns-tz';
import { millisecondsInHour } from 'date-fns';
import { lookup } from 'zipcode-to-timezone';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Resolver(() => Member)
export class MemberResolver {
  private readonly authenticationPrefix = 'Bearer ';

  constructor(private readonly memberService: MemberService, private eventEmitter: EventEmitter2) {}

  @Mutation(() => Identifier)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    remove(createMemberParams.usersIds, (i) => i === createMemberParams.primaryCoachId);

    const { firstName, lastName } = createMemberParams;
    const dischargeNotesLink = `${firstName}_${lastName}_Summary.pdf`;
    const dischargeInstructionsLink = `${firstName}_${lastName}_Instructions.pdf`;

    const member = await this.memberService.insert({
      createMemberParams,
      dischargeNotesLink,
      dischargeInstructionsLink,
    });

    this.eventEmitter.emit(EventType.collectUsersDataBridge, {
      member,
      primaryCoachId: createMemberParams.primaryCoachId,
      usersIds: createMemberParams.usersIds,
    });

    return member;
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
