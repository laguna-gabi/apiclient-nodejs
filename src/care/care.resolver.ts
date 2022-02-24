import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Barrier,
  BarrierType,
  CarePlan,
  CarePlanType,
  CareService,
  CreateCarePlanParams,
  CreateRedFlagParams,
  RedFlag,
  UpdateBarrierParams,
  UpdateCarePlanParams,
} from '.';
import { Client, LoggingInterceptor, Roles, UserRole } from '../common';
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

  @Mutation(() => RedFlag)
  @Roles(UserRole.coach, UserRole.nurse)
  async createRedFlag(
    @Client('_id') userId,
    @Args(camelCase(CreateRedFlagParams.name)) createRedFlagParams: CreateRedFlagParams,
  ): Promise<RedFlag> {
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

  @Mutation(() => Barrier)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateBarrier(
    @Args(camelCase(UpdateBarrierParams.name)) updateBarrierParams: UpdateBarrierParams,
  ): Promise<Barrier> {
    return this.careService.updateBarrier(updateBarrierParams);
  }

  @Query(() => [Barrier])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberBarriers(
    @Args('memberId', { type: () => String }) memberId: string,
  ): Promise<Barrier[]> {
    return this.careService.getMemberBarriers(memberId);
  }

  /**************************************************************************************************
   ******************************************** Care Plan *******************************************
   *************************************************************************************************/

  @Query(() => [CarePlanType])
  @Roles(UserRole.coach, UserRole.nurse)
  async getCarePlanTypes(): Promise<CarePlanType[]> {
    return this.careService.getCarePlanTypes();
  }

  @Mutation(() => CarePlan)
  @Roles(UserRole.coach, UserRole.nurse)
  async createCarePlan(
    @Client('_id') userId,
    @Args(camelCase(CreateCarePlanParams.name)) createCarePlanParams: CreateCarePlanParams,
  ): Promise<CarePlan> {
    return this.careService.createCarePlan({
      ...createCarePlanParams,
      createdBy: userId,
    });
  }

  @Mutation(() => CarePlan)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateCarePlan(
    @Args(camelCase(UpdateCarePlanParams.name)) updateCarePlanParams: UpdateCarePlanParams,
  ): Promise<CarePlan> {
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
