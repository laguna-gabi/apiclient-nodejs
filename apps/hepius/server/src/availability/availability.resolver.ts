import { UserRole } from '@argus/hepiusClient';
import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Availability, AvailabilityInput, AvailabilityService, AvailabilitySlot } from '.';
import {
  Ace,
  AceStrategy,
  Client,
  ErrorType,
  Errors,
  Identifiers,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Availability)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Mutation(() => Identifiers)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.token })
  async createAvailabilities(
    @Client('_id') userId,
    @Args('availabilities', { type: () => [AvailabilityInput] })
    availabilities: AvailabilityInput[],
  ): Promise<Identifiers> {
    return this.availabilityService.create(availabilities, userId);
  }

  @Query(() => [AvailabilitySlot])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getAvailabilities(): Promise<AvailabilitySlot[]> {
    return this.availabilityService.get();
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async deleteAvailability(
    @Client('_id') userId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.availabilityIdInvalid)),
    )
    id: string,
  ) {
    return this.availabilityService.delete(id, userId);
  }
}
