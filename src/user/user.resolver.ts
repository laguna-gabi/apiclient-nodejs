import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UserService } from './user.service';
import { camelCase, difference } from 'lodash';
import { Errors } from '../common';
import { User, UserRole, CreateUserParams } from './user.dto';

@Resolver(() => User)
export class UserResolver {
  private readonly allowedValues = Object.values(UserRole);

  constructor(private readonly userService: UserService) {}

  @Mutation(() => User)
  async createUser(
    @Args(camelCase(CreateUserParams.name))
    createUserParams: CreateUserParams,
  ) {
    if (difference(createUserParams.roles, this.allowedValues).length > 0) {
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
