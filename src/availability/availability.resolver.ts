import { UseInterceptors } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService, AvailabilitySlot } from '.';
import { Identifiers, LoggingInterceptor, Roles, UserRole, extractUserId } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Availability)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Mutation(() => Identifiers)
  @Roles(UserRole.coach)
  async createAvailabilities(
    @Context() context,
    @Args('availabilities', { type: () => [AvailabilityInput] })
    availabilities: AvailabilityInput[],
  ): Promise<Identifiers> {
    const userId = extractUserId(context);
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
