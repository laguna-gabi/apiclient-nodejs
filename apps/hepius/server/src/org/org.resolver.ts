import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateOrgParams, Org, OrgService } from '.';
import {
  Ace,
  AceStrategy,
  ErrorType,
  Errors,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
} from '../common';
import { Identifier, UserRole } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Org)
export class OrgResolver {
  constructor(private readonly orgService: OrgService) {}

  @Mutation(() => Identifier)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async createOrg(
    @Args(camelCase(CreateOrgParams.name))
    createOrgParams: CreateOrgParams,
  ): Promise<Identifier> {
    return this.orgService.insert(createOrgParams);
  }

  @Query(() => Org, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getOrg(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberOrgIdInvalid)),
    )
    id: string,
  ): Promise<Org | null> {
    return this.orgService.get(id);
  }

  @Query(() => [Org])
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async getOrgs(): Promise<Org[]> {
    return this.orgService.getOrgs();
  }
}
