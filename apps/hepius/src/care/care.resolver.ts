import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CareService,
  CreateCarePlanParams,
  RedFlag,
  RedFlagType,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '.';
import {
  Client,
  ErrorType,
  Errors,
  Identifiers,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
} from '../common';
import { camelCase } from 'lodash';
import { SubmitCareWizardParams } from './wizard.dto';
import { Barrier, BarrierType, CarePlan, CarePlanType, UserRole } from '@argus/hepiusClient';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class CareResolver {
  constructor(private readonly careService: CareService) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  @Query(() => [RedFlag])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberRedFlags(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<RedFlag[]> {
    return this.careService.getMemberRedFlags(memberId);
  }

  @Query(() => [RedFlagType])
  @Roles(UserRole.coach, UserRole.nurse)
  async getRedFlagTypes(): Promise<RedFlagType[]> {
    return this.careService.getRedFlagTypes();
  }

  @Mutation(() => RedFlag)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateRedFlag(
    @Args(camelCase(UpdateRedFlagParams.name)) updateRedFlagParams: UpdateRedFlagParams,
  ): Promise<RedFlag> {
    return this.careService.updateRedFlag(updateRedFlagParams);
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
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
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
    @Args(camelCase(CreateCarePlanParams.name)) createCarePlanParams: CreateCarePlanParams,
  ): Promise<CarePlan> {
    return this.careService.createCarePlan({
      ...createCarePlanParams,
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
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<CarePlan[]> {
    return this.careService.getMemberCarePlans(memberId);
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.coach, UserRole.nurse)
  async deleteCarePlan(
    @Client('_id') userId,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.carePlanIdInvalid)),
    )
    id: string,
  ) {
    return this.careService.deleteCarePlan(id, userId);
  }

  @Mutation(() => Identifiers)
  @Roles(UserRole.coach, UserRole.nurse)
  async submitCareWizard(
    @Args(camelCase(SubmitCareWizardParams.name)) submitCareWizardParams: SubmitCareWizardParams,
  ): Promise<Identifiers> {
    const { memberId, redFlag } = submitCareWizardParams;
    const { barriers, ...redFlagParams } = redFlag;
    const { id: redFlagId } = await this.careService.createRedFlag({
      ...redFlagParams,
      memberId,
    });
    const submittedCarePlans = [];
    await Promise.all(
      barriers.map(async (barrier) => {
        const { carePlans, ...barrierParams } = barrier;
        const { id: barrierId } = await this.careService.createBarrier({
          ...barrierParams,
          memberId,
          redFlagId,
        });
        await Promise.all(
          carePlans.map(async (carePlan) => {
            const { id: carePlanId } = await this.careService.createCarePlan({
              ...carePlan,
              memberId,
              barrierId,
            });
            submittedCarePlans.push(carePlanId);
          }),
        );
      }),
    );
    return { ids: submittedCarePlans };
  }
}
