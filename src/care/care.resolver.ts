import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  BarrierType,
  CarePlan,
  CarePlanType,
  CareService,
  CreateCarePlanParams,
  CreateRedFlagParams,
  RedFlag,
  UpdateCarePlanParams,
} from '.';
import { Client, Identifier, LoggingInterceptor, Roles, UserRole } from '../common';
import { camelCase } from 'lodash';
import { redFlags } from './redFlags.json';
import { GraphQLJSONObject } from 'graphql-type-json';

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

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async deleteRedFlag(@Client('_id') userId, @Args('id', { type: () => String }) id: string) {
    return this.careService.deleteRedFlag(id, userId);
  }

  @Query(() => [GraphQLJSONObject])
  @Roles(UserRole.coach, UserRole.nurse)
  async getRedFlagTypes() {
    return redFlags;
  }

  /**************************************************************************************************
   ********************************************* Barrier ********************************************
   *************************************************************************************************/

  @Query(() => [BarrierType])
  @Roles(UserRole.coach, UserRole.nurse)
  async getBarrierTypes(): Promise<BarrierType[]> {
    return this.careService.getBarrierTypes();
  }

  /**************************************************************************************************
   ******************************************** Care Plan *******************************************
   *************************************************************************************************/

  @Query(() => [CarePlanType])
  @Roles(UserRole.coach, UserRole.nurse)
  async getCarePlanTypes(): Promise<CarePlanType[]> {
    return this.careService.getCarePlanTypes();
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async createCarePlan(
    @Client('_id') userId,
    @Args(camelCase(CreateCarePlanParams.name)) createCarePlanParams: CreateCarePlanParams,
  ): Promise<Identifier> {
    return this.careService.createCarePlan({
      ...createCarePlanParams,
      createdBy: userId,
    });
  }

  @Mutation(() => Identifier)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateCarePlan(
    @Args(camelCase(UpdateCarePlanParams.name)) updateCarePlanParams: UpdateCarePlanParams,
  ): Promise<Identifier> {
    return this.careService.updateCarePlan(updateCarePlanParams);
  }

  @Query(() => [CarePlan])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberCarePlans(
    @Args('memberId', { type: () => String }) memberId: string,
  ): Promise<CarePlan[]> {
    return this.careService.getMemberCarePlans(memberId);
  }
}
