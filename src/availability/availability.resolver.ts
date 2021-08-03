import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService, AvailabilitySlot } from '.';
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

  @Query(() => [AvailabilitySlot])
  async getAvailabilities() {
    return this.availabilityService.get();
  }

  @Mutation(() => Boolean, { nullable: true })
  async deleteAvailability(@Args('id', { type: () => String }) id: string) {
    await this.availabilityService.delete(id);
  }
}
