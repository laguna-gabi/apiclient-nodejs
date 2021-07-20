import { Args, Mutation, Resolver } from '@nestjs/graphql';
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
}
