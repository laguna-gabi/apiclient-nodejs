import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService, AvailabilitySlot } from '.';
import { Client, Identifiers, LoggingInterceptor, Roles, UserRole } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Availability)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Mutation(() => Identifiers)
  @Roles(UserRole.coach)
  async createAvailabilities(
    @Client('_id') userId,
    @Args('availabilities', { type: () => [AvailabilityInput] })
    availabilities: AvailabilityInput[],
  ): Promise<Identifiers> {
    return this.availabilityService.create(availabilities, userId);
  }

  @Query(() => [AvailabilitySlot])
  @Roles(UserRole.coach)
  async getAvailabilities(): Promise<AvailabilitySlot[]> {
    return this.availabilityService.get();
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach)
  async deleteAvailability(@Args('id', { type: () => String }) id: string) {
    return this.availabilityService.delete(id);
  }
}
