import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CoachService } from './coach.service';
import { camelCase } from 'lodash';
import { Errors } from '../common';
import {
  Coach,
  CoachRole,
  CreateCoachParams,
  GetCoachParams,
} from './coach.dto';

@Resolver(() => Coach)
export class CoachResolver {
  constructor(private readonly coachService: CoachService) {}

  @Mutation(() => Coach)
  async createCoach(
    @Args(camelCase(CreateCoachParams.name))
    createCoachParams: CreateCoachParams,
  ) {
    if (
      !(Object.values(CoachRole) as string[]).includes(createCoachParams.role)
    ) {
      throw new Error(
        `${Errors.coach.create.title} : ${
          Errors.coach.create.reasons.role
        }${Object.values(CoachRole)}`,
      );
    }

    return this.coachService.insert(createCoachParams);
  }

  @Query(() => Coach, { nullable: true })
  async getCoach(
    @Args(camelCase(GetCoachParams.name)) getCoachParams: GetCoachParams,
  ) {
    return this.coachService.get(getCoachParams);
  }
}
