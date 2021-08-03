import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService } from '.';

@Resolver(() => Availability)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Mutation(() => Boolean, { nullable: true })
  async createAvailabilities(
    @Args('availabilities', { type: () => [AvailabilityInput] })
    availabilities: AvailabilityInput[],
  ) {
    return this.availabilityService.create(availabilities);
  }
}
