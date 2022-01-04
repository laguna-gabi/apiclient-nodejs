import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase, isUndefined, omitBy } from 'lodash';
import { CreateUserParams, GetSlotsParams, Slots, User, UserConfig, UserService } from '.';
import {
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventNotifyQueue,
  IEventOnNewUser,
  Identifier,
  LoggingInterceptor,
  Roles,
  UserRole,
} from '../common';
import {
  ClientCategory,
  IUpdateClientSettings,
  InnerQueueTypes,
  QueueType,
} from '@lagunahealth/pandora';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService, private eventEmitter: EventEmitter2) {}

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    const user = await this.userService.insert(createUserParams);

    const eventParams: IEventOnNewUser = { user };
    this.eventEmitter.emit(EventType.onNewUser, eventParams);
    this.notifyUpdatedUserConfig(user);

    return { id: user.id };
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
  async getUserConfig(@Args('id', { type: () => String }) id: string): Promise<UserConfig> {
    return this.userService.getUserConfig(id);
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
