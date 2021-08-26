import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateUserParams, User, UserService, UserConfig } from '.';
import { EventType, Identifier } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetSlotsParams, Slots } from './slot.dto';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService, private eventEmitter: EventEmitter2) {}

  @Mutation(() => Identifier)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    const user = await this.userService.insert(createUserParams);

    this.eventEmitter.emit(EventType.newUser, { user });

    return { id: user.id };
  }

  @Query(() => User, { nullable: true })
  async getUser(@Args('id', { type: () => String }) id: string) {
    return this.userService.get(id);
  }

  @Query(() => [User])
  async getUsers() {
    return this.userService.getUsers();
  }

  @Query(() => Slots)
  async getUserSlots(@Args(camelCase(GetSlotsParams.name)) getSlotsParams: GetSlotsParams) {
    return this.userService.getSlots(getSlotsParams);
  }

  @Query(() => UserConfig)
  async getUserConfig(@Args('id', { type: () => String }) id: string) {
    return this.userService.getUserConfig(id);
  }
}
