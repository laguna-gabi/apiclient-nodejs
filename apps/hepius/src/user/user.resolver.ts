import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase, isUndefined, omitBy } from 'lodash';
import {
  CreateUserParams,
  GetSlotsParams,
  Slots,
  UpdateUserParams,
  User,
  UserConfig,
  UserService,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewUser,
  IEventOnUpdatedUser,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
  UserRole,
} from '../common';
import { ClientCategory, IUpdateClientSettings, InnerQueueTypes, QueueType } from '@argus/pandora';
import { CognitoService } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cognitoService: CognitoService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => User)
  @Roles(UserRole.coach, UserRole.nurse)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    const { id } = await this.userService.insert(createUserParams);
    const authId = await this.cognitoService.addClient(createUserParams);
    const user = await this.userService.updateAuthId(id, authId);

    const eventParams: IEventOnNewUser = { user };
    this.eventEmitter.emit(EventType.onNewUser, eventParams);
    this.notifyUpdatedUserConfig(user);

    return user;
  }

  @Mutation(() => User)
  @Roles(UserRole.admin)
  async updateUser(
    @Args(camelCase(UpdateUserParams.name))
    updateUserParams: UpdateUserParams,
  ) {
    const user = await this.userService.update(updateUserParams);
    this.notifyUpdatedUserConfig(user);

    if (user.firstName || user.lastName || user.avatar) {
      const eventParams: IEventOnUpdatedUser = { user };
      this.eventEmitter.emit(EventType.onUpdatedUser, eventParams);
    }

    return user;
  }

  @Query(() => User, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getUser(@Client('_id') userId): Promise<User> {
    const user = await this.userService.get(userId);
    if (!user) {
      throw new Error(Errors.get(ErrorType.userNotFound));
    }
    return user;
  }

  @Query(() => [User])
  @Roles(UserRole.coach, UserRole.nurse)
  async getUsers(
    @Args('roles', {
      type: () => [UserRole],
      nullable: true,
      defaultValue: [UserRole.coach, UserRole.nurse],
    })
    roles: UserRole[] = [UserRole.coach, UserRole.nurse],
  ): Promise<User[]> {
    return this.userService.getUsers(roles);
  }

  @Query(() => Slots)
  @Roles(UserRole.coach, UserRole.nurse)
  async getUserSlots(
    @Args(camelCase(GetSlotsParams.name)) getSlotsParams: GetSlotsParams,
  ): Promise<Slots> {
    return this.userService.getSlots(getSlotsParams);
  }

  @Query(() => UserConfig)
  @Roles(UserRole.coach, UserRole.nurse)
  async getUserConfig(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.userIdInvalid)))
    id: string,
  ): Promise<UserConfig> {
    return this.userService.getUserConfig(id);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async setLastQueryAlert(@Client('_id') userId: string): Promise<boolean> {
    await this.userService.setLatestQueryAlert(userId);

    return true;
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
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
  @Roles(UserRole.coach, UserRole.nurse)
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
    this.eventEmitter.emit(EventType.notifyQueue, eventSettingsParams);
  }
}
