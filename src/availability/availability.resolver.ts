import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService } from '.';
import { Identifiers } from '../common';

@Resolver(() => Availability)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Mutation(() => Identifiers)
  async createAvailabilities(
    @Args('availabilities', { type: () => [AvailabilityInput] })
    availabilities: AvailabilityInput[],
  ) {
    return this.availabilityService.create(availabilities);
  }
}
