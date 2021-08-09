import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  Member,
  MemberService,
  MemberSummary,
  TaskStatus,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '.';
import { Errors, ErrorType, EventType, Identifier } from '../common';
import { camelCase } from 'lodash';
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
      usersIds: createMemberParams.usersIds,
    });

    return member;
  }

  /**
   * Can be called from 2 sources:
   * @param context : mobile - by using authorization header in context
   * @param id : web - by using a query param of member id
   */
  @Query(() => Member, { nullable: true })
  async getMember(
    @Context() context,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    let member;
    if (id) {
      member = await this.memberService.get(id);
    } else {
      const deviceId = this.extractDeviceId(context);
      member = await this.memberService.getByDeviceId(deviceId);
    }
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
    return this.memberService.insertGoal({ createTaskParams, status: TaskStatus.pending });
  }

  @Mutation(() => Boolean, { nullable: true })
  async updateGoalStatus(
    @Args(camelCase(UpdateTaskStatusParams.name))
    updateTaskStatusParams: UpdateTaskStatusParams,
  ) {
    return this.memberService.updateGoalStatus(updateTaskStatusParams);
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
      status: TaskStatus.pending,
    });
  }

  @Mutation(() => Boolean, { nullable: true })
  async updateActionItemStatus(
    @Args(camelCase(UpdateTaskStatusParams.name))
    updateTaskStatusParams: UpdateTaskStatusParams,
  ) {
    return this.memberService.updateActionItemStatus(updateTaskStatusParams);
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
