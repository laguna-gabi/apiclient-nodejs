import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateOrgParams, Org, OrgService } from '.';
import { Identifier, LoggingInterceptor } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Org)
export class OrgResolver {
  constructor(private readonly orgService: OrgService) {}

  @Mutation(() => Identifier)
  async createOrg(
    @Args(camelCase(CreateOrgParams.name))
    createOrgParams: CreateOrgParams,
  ) {
    return this.orgService.insert(createOrgParams);
  }

  @Query(() => Org, { nullable: true })
  async getOrg(@Args('id', { type: () => String }) id: string) {
    return this.orgService.get(id);
  }
}
