import { MemberRole, User, UserRole } from '@argus/hepiusClient';
import { IUpdateClientSettings, InnerQueueTypes } from '@argus/irisClient';
import { ClientCategory, EntityName, GlobalEventType, QueueType, formatEx } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase, isUndefined, omitBy } from 'lodash';
import {
  CreateUserParams,
  GetSlotsParams,
  Slots,
  UpdateUserParams,
  UserConfig,
  UserService,
  UserStatistics,
  UserSummary,
} from '.';
import {
  Ace,
  AceStrategy,
  Client,
  ClientSpread,
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewUser,
  IEventOnUpdatedUser,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  Roles,
} from '../common';
import { CognitoService, Voximplant, ZenDesk } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cognitoService: CognitoService,
    private readonly zendeskProvider: ZenDesk,
    private readonly voximplant: Voximplant,
    private eventEmitter: EventEmitter2,
    private readonly logger: LoggerService,
  ) {}

  @Mutation(() => User)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    const { id } = await this.userService.insert(createUserParams);
    let authId, username;

    try {
      ({ authId, username } = await this.cognitoService.addUser(createUserParams));
    } catch (ex) {
      await this.userService.delete(id);
      this.logger.error(createUserParams, UserResolver.name, this.createUser.name, formatEx(ex));
      throw new Error(Errors.get(ErrorType.userFailedToCreateOnExternalProvider));
    }

    const user = await this.userService.updateAuthIdAndUsername(id, authId, username);

    const eventParams: IEventOnNewUser = { user };
    this.eventEmitter.emit(EventType.onNewUser, eventParams);
    this.notifyUpdatedUserConfig(user);

    return user;
  }

  @Mutation(() => User)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async updateUser(
    @Args(camelCase(UpdateUserParams.name))
    updateUserParams: UpdateUserParams,
  ) {
    const oldUser = await this.userService.get(updateUserParams.id);
    const user = await this.userService.update(updateUserParams);
    this.notifyUpdatedUserConfig(user);

    if (
      oldUser.firstName !== user.firstName ||
      oldUser.lastName !== updateUserParams.lastName ||
      oldUser.avatar !== updateUserParams.avatar
    ) {
      const eventParams: IEventOnUpdatedUser = { user };
      this.eventEmitter.emit(EventType.onUpdatedUser, eventParams);
    }

    return user;
  }

  @Query(() => User, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async getUser(@Client('_id') userId): Promise<User> {
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return user;
  }

  @Query(() => [UserSummary])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.byOrg, idLocator: 'orgIds' })
  async getUsers(
    @Args('orgIds', {
      type: () => [String],
      nullable: true,
    })
    orgIds?: string[],
  ): Promise<UserSummary[]> {
    const users = await this.userService.getUsers(orgIds);
    const usersStatusMap = await this.cognitoService.listUsersStatus();

    const array = [];

    users.forEach((item) =>
      array.push({
        ...item,
        isEnabled: usersStatusMap.has(item.username) ? usersStatusMap.get(item.username) : false,
      }),
    );

    return array;
  }

  @Query(() => Slots)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.byOrg, idLocator: 'orgIds' })
  async getUserSlots(
    @Args(camelCase(GetSlotsParams.name)) getSlotsParams: GetSlotsParams,
  ): Promise<Slots> {
    return this.userService.getSlots(getSlotsParams);
  }

  @Query(() => Slots)
  @Roles(MemberRole.member)
  @Ace({
    entityName: EntityName.appointment,
    idLocator: `appointmentId`,
    entityMemberIdLocator: 'memberId',
  })
  async getUserSlotsByAppointmentId(
    @Args(
      'appointmentId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.appointmentIdInvalid)),
    )
    appointmentId: string,
  ): Promise<Slots> {
    return this.userService.getSlots({ appointmentId });
  }

  @Query(() => UserConfig)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async getUserConfig(@Client('_id') userId): Promise<UserConfig> {
    return this.userService.getUserConfig(userId);
  }

  @Query(() => String)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async getHelpCenterToken(
    @ClientSpread(['firstName', 'lastName', 'email'])
    { firstName, lastName, email },
  ): Promise<string> {
    return this.zendeskProvider.getAuthToken({ firstName, lastName, email });
  }

  @Query(() => UserStatistics)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async getUserStatistics(
    @Client('id')
    userId,
  ): Promise<UserStatistics> {
    return this.userService.getUserStatistics(userId);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async setLastQueryAlert(@Client('_id') userId: string): Promise<boolean> {
    await this.userService.setLatestQueryAlert(userId);

    return true;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async disableUser(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.userIdInvalid)))
    id: string,
  ): Promise<boolean> {
    const user = await this.userService.get(id);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return this.cognitoService.disableClient(user.firstName.toLowerCase());
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async enableUser(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.userIdInvalid)))
    id: string,
  ): Promise<boolean> {
    const user = await this.userService.get(id);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }

    return this.cognitoService.enableClient(user.firstName.toLowerCase());
  }

  @Query(() => String)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
  async getVoximplantToken(
    @Client('id')
    userId,
    @Args('key', { type: () => String })
    key: string,
  ): Promise<string> {
    const { voximplantPassword } = await this.userService.getUserConfig(userId);
    return this.voximplant.generateToken({
      userName: userId,
      userPassword: voximplantPassword,
      key,
    });
  }

  protected notifyUpdatedUserConfig(user: User) {
    const settings: Partial<IUpdateClientSettings> = omitBy(
      {
        type: InnerQueueTypes.updateClientSettings,
        id: user.id,
        clientCategory: ClientCategory.user,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      },
      isUndefined,
    );
    const eventSettingsParams: IEventNotifyQueue = {
      type: QueueType.notifications,
      message: JSON.stringify(settings),
    };
    this.eventEmitter.emit(GlobalEventType.notifyQueue, eventSettingsParams);
  }
}
