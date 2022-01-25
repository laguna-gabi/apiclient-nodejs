import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CareService, CreateRedFlagParams, RedFlag } from '.';
import { Client, Identifier, LoggingInterceptor, Roles, UserRole } from '../common';
import { camelCase } from 'lodash';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class CareResolver {
  constructor(private readonly careService: CareService) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createRedFlag(
    @Client('_id') userId,
    @Args(camelCase(CreateRedFlagParams.name)) createRedFlagParams: CreateRedFlagParams,
  ): Promise<Identifier> {
    return this.careService.createRedFlag({
      ...createRedFlagParams,
      createdBy: userId,
    });
  }

  @Query(() => [RedFlag])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberRedFlags(
    @Args('memberId', { type: () => String }) memberId: string,
  ): Promise<RedFlag[]> {
    return this.careService.getMemberRedFlags(memberId);
  }
}
