import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateOrgParams, Org, OrgService } from '.';
import { ErrorType, Errors, IsValidObjectId, LoggingInterceptor, Roles } from '../common';
import { Identifier, UserRole } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Org)
export class OrgResolver {
  constructor(private readonly orgService: OrgService) {}

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createOrg(
    @Args(camelCase(CreateOrgParams.name))
    createOrgParams: CreateOrgParams,
  ): Promise<Identifier> {
    return this.orgService.insert(createOrgParams);
  }

  @Query(() => Org, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
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
  @Roles(UserRole.admin)
  async getOrgs(): Promise<Org[]> {
    return this.orgService.getOrgs();
  }
}
