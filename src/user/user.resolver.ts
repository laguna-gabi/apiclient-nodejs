import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateUserParams, GetSlotsParams, Slots, User, UserConfig, UserService } from '.';
import {
  EventType,
  IEventOnNewUser,
  Identifier,
  LoggingInterceptor,
  Roles,
  UserRole,
  extractUserId,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService, private eventEmitter: EventEmitter2) {}

  @Mutation(() => Identifier)
  @Roles(UserRole.coach)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    const user = await this.userService.insert(createUserParams);

    const eventParams: IEventOnNewUser = { user };
    this.eventEmitter.emit(EventType.onNewUser, eventParams);

    return { id: user.id };
  }

  @Query(() => User, { nullable: true })
  @Roles(UserRole.coach)
  async getUser(@Context() context): Promise<User> {
    const userId = extractUserId(context);
    return this.userService.get(userId);
  }

  @Query(() => [User])
  @Roles(UserRole.coach)
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
  @Roles(UserRole.coach)
  async getUserSlots(
    @Args(camelCase(GetSlotsParams.name)) getSlotsParams: GetSlotsParams,
  ): Promise<Slots> {
    return this.userService.getSlots(getSlotsParams);
  }

  @Query(() => UserConfig)
  @Roles(UserRole.coach)
  async getUserConfig(@Args('id', { type: () => String }) id: string): Promise<UserConfig> {
    return this.userService.getUserConfig(id);
  }
}
