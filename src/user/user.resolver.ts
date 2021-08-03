import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateUserParams, User, UserService } from '.';
import { EventType, Identifier } from '../common';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
}
