import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateUserParams, User, UserService } from '.';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    return this.userService.insert(createUserParams);
  }

  @Query(() => User, { nullable: true })
  async getUser(@Args('id', { type: () => String }) id: string) {
    return this.userService.get(id);
  }
}
