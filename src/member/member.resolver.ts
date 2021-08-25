import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AppointmentCompose,
  CreateMemberParams,
  CreateTaskParams,
  DischargeDocumentsLinks,
  Member,
  MemberConfig,
  MemberService,
  MemberSummary,
  SetGeneralNotesParams,
  TaskStatus,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '.';
import {
  CallParams,
  Errors,
  ErrorType,
  EventType,
  Identifier,
  MobilePlatform,
  RegisterForNotificationParams,
} from '../common';
import { camelCase } from 'lodash';
import * as jwt from 'jsonwebtoken';
import { getTimezoneOffset } from 'date-fns-tz';
import { millisecondsInHour } from 'date-fns';
import { lookup } from 'zipcode-to-timezone';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService, StorageService } from '../providers';

@Resolver(() => Member)
export class MemberResolver {
  private readonly authenticationPrefix = 'Bearer ';

  constructor(
    private readonly memberService: MemberService,
    private eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Mutation(() => Identifier)
  async createMember(
    @Args(camelCase(CreateMemberParams.name))
    createMemberParams: CreateMemberParams,
  ) {
    const member = await this.memberService.insert(createMemberParams);

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
    member.zipCode = member.zipCode || member.org.zipCode;

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

  @Query(() => DischargeDocumentsLinks)
  async getMemberDischargeDocumentsLinks(@Args('id', { type: () => String }) id: string) {
    console.log('1 getMemberDischargeDocumentsLinks');
    const member = await this.memberService.get(id);
    console.log('2 getMemberDischargeDocumentsLinks');

    const { firstName, lastName } = member;
    console.log(`3 getMemberDischargeDocumentsLinks firstName=${firstName} lastName=${lastName}`);

    const [dischargeNotesLink, dischargeInstructionsLink] = await Promise.all([
      await this.storageService.getUrl(`${firstName}_${lastName}_Summary.pdf`),
      await this.storageService.getUrl(`${firstName}_${lastName}_Instructions.pdf`),
    ]);

    console.log(
      `4 getMemberDischargeDocumentsLinks dischargeNotesLink=${dischargeNotesLink}` +
        `dischargeInstructionsLink=${dischargeInstructionsLink}`,
    );

    return { dischargeNotesLink, dischargeInstructionsLink };
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
   ****************************************** General notes ****************************************
   ************************************************************************************************/
  @Mutation(() => Boolean, { nullable: true })
  async setGeneralNotes(
    @Args(camelCase(SetGeneralNotesParams.name)) setGeneralNotesParams: SetGeneralNotesParams,
  ) {
    return this.memberService.setGeneralNotes(setGeneralNotesParams);
  }

  /************************************************************************************************
   ***************************************** Notifications ****************************************
   ************************************************************************************************/
  @Mutation(() => Boolean, { nullable: true })
  async registerMemberForNotifications(
    @Args(camelCase(RegisterForNotificationParams.name))
    registerForNotificationParams: RegisterForNotificationParams,
  ) {
    const memberConfig = await this.memberService.getMemberConfig(
      registerForNotificationParams.memberId,
    );

    if (registerForNotificationParams.mobilePlatform === MobilePlatform.ios) {
      const { token } = registerForNotificationParams;
      await this.notificationsService.register({
        token,
        externalUserId: memberConfig.externalUserId,
      });
    }
    await this.memberService.updateMemberConfig({
      memberId: memberConfig.memberId,
      mobilePlatform: registerForNotificationParams.mobilePlatform,
    });
  }

  /************************************************************************************************
   **************************************** Member Internal ***************************************
   ************************************************************************************************/
  @Query(() => MemberConfig)
  async getMemberConfig(@Args('id', { type: () => String }) id: string) {
    return this.memberService.getMemberConfig(id);
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
