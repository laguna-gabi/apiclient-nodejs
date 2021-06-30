import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserService } from './user.service';
import { camelCase } from 'lodash';
import { Errors } from '../common';
import { User, UserRole, CreateUserParams } from './user.dto';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    if (
      !(Object.values(UserRole) as string[]).includes(createUserParams.role)
    ) {
      throw new Error(
        `${Errors.user.create.title} : ${
          Errors.user.create.reasons.role
        }${Object.values(UserRole)}`,
      );
    }

    return this.userService.insert(createUserParams);
  }

  @Query(() => User, { nullable: true })
  async getUser(@Args('id', { type: () => String }) id: string) {
    return this.userService.get(id);
  }
}
