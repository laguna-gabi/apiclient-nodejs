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
  UserSummary,
} from '.';
import {
  Ace,
  AceStrategy,
  Client,
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
import { CognitoService } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cognitoService: CognitoService,
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getUser(@Client('_id') userId): Promise<User> {
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return user;
  }

  @Query(() => [UserSummary])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getUsers(
    @Args('roles', {
      type: () => [UserRole],
      nullable: true,
      defaultValue: [UserRole.lagunaCoach, UserRole.lagunaNurse],
    })
    roles: UserRole[] = [UserRole.lagunaCoach, UserRole.lagunaNurse],
  ): Promise<UserSummary[]> {
    const users = await this.userService.getUsers(roles);
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getUserConfig(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.userIdInvalid)))
    id: string,
  ): Promise<UserConfig> {
    return this.userService.getUserConfig(id);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async setLastQueryAlert(@Client('_id') userId: string): Promise<boolean> {
    await this.userService.setLatestQueryAlert(userId);

    return true;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
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
