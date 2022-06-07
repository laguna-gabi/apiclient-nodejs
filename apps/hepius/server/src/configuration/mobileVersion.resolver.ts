import { UserRole } from '@argus/hepiusClient';
import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  CreateMobileVersionParams,
  MobileVersion,
  MobileVersionService,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '.';
import { Ace, AceStrategy, LoggingInterceptor, Roles } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => MobileVersion)
export class MobileVersionResolver {
  constructor(private readonly mobileVersionService: MobileVersionService) {}

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async createMobileVersion(
    @Args(camelCase(CreateMobileVersionParams.name))
    createMobileVersionParams: CreateMobileVersionParams,
  ) {
    return this.mobileVersionService.createMobileVersion(createMobileVersionParams);
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async updateMinMobileVersion(
    @Args(camelCase(UpdateMinMobileVersionParams.name))
    updateMinMobileVersionParams: UpdateMinMobileVersionParams,
  ) {
    return this.mobileVersionService.updateMinMobileVersion(updateMinMobileVersionParams);
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async updateFaultyMobileVersions(
    @Args(camelCase(UpdateFaultyMobileVersionsParams.name))
    updateFaultyMobileVersionsParams: UpdateFaultyMobileVersionsParams,
  ) {
    return this.mobileVersionService.updateFaultyMobileVersions(updateFaultyMobileVersionsParams);
  }
}
