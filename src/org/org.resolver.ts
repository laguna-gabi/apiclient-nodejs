import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { CreateOrgParams, Org, OrgService } from '.';
import { Identifier } from '../common';
import { camelCase } from 'lodash';

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
