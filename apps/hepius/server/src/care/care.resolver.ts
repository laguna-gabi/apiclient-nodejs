import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CareService,
  CreateBarrierParams,
  DeleteCarePlanParams,
  RedFlag,
  RedFlagType,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '.';
import {
  Ace,
  AceStrategy,
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
import {
  Barrier,
  BarrierType,
  CarePlan,
  CarePlanType,
  CreateCarePlanParams,
  UserRole,
} from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { JourneyService } from '../journey';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class CareResolver {
  constructor(
    private readonly careService: CareService,
    private readonly journeyService: JourneyService,
  ) {}

  /**************************************************************************************************
   ******************************************** Red Flag ********************************************
   *************************************************************************************************/

  @Query(() => [RedFlag])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberRedFlags(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<RedFlag[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.careService.getMemberRedFlags({ memberId, journeyId });
  }

  @Query(() => [RedFlagType])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
  async getRedFlagTypes(): Promise<RedFlagType[]> {
    return this.careService.getRedFlagTypes();
  }

  @Mutation(() => RedFlag)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.redflag, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async updateRedFlag(
    @Args(camelCase(UpdateRedFlagParams.name)) updateRedFlagParams: UpdateRedFlagParams,
  ): Promise<RedFlag> {
    return this.careService.updateRedFlag(updateRedFlagParams);
  }

  /**************************************************************************************************
   ********************************************* Barrier ********************************************
   *************************************************************************************************/

  @Query(() => [BarrierType])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
  async getBarrierTypes(): Promise<BarrierType[]> {
    return this.careService.getBarrierTypes();
  }

  @Mutation(() => Barrier)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async createBarrier(
    @Args(camelCase(CreateBarrierParams.name)) createBarrierParams: CreateBarrierParams,
  ): Promise<Barrier> {
    const { id: journeyId } = await this.journeyService.getRecent(createBarrierParams.memberId);
    return this.careService.createBarrier({ ...createBarrierParams, journeyId });
  }

  @Mutation(() => Barrier)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.barrier, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async updateBarrier(
    @Args(camelCase(UpdateBarrierParams.name)) updateBarrierParams: UpdateBarrierParams,
  ): Promise<Barrier> {
    return this.careService.updateBarrier(updateBarrierParams);
  }

  @Query(() => [Barrier])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberBarriers(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<Barrier[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.careService.getMemberBarriers({ memberId, journeyId });
  }

  /**************************************************************************************************
   ******************************************** Care Plan *******************************************
   *************************************************************************************************/

  @Query(() => [CarePlanType])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
  async getCarePlanTypes(): Promise<CarePlanType[]> {
    return this.careService.getCarePlanTypes();
  }

  @Mutation(() => CarePlan)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async createCarePlan(
    @Args(camelCase(CreateCarePlanParams.name)) createCarePlanParams: CreateCarePlanParams,
  ): Promise<CarePlan> {
    const { id: journeyId } = await this.journeyService.getRecent(createCarePlanParams.memberId);
    return this.careService.createCarePlan({ ...createCarePlanParams, journeyId });
  }

  @Mutation(() => CarePlan)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.careplan, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async updateCarePlan(
    @Args(camelCase(UpdateCarePlanParams.name)) updateCarePlanParams: UpdateCarePlanParams,
  ): Promise<CarePlan> {
    return this.careService.updateCarePlan(updateCarePlanParams);
  }

  @Query(() => [CarePlan])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberCarePlans(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<CarePlan[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.careService.getMemberCarePlans({ memberId, journeyId });
  }

  @Mutation(() => Boolean)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.careplan, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async deleteCarePlan(
    @Client('_id') userId,
    @Args(camelCase(DeleteCarePlanParams.name)) deleteCarePlanParams: DeleteCarePlanParams,
  ) {
    return this.careService.deleteCarePlan(deleteCarePlanParams, userId);
  }

  @Mutation(() => Identifiers)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async submitCareWizard(
    @Args(camelCase(SubmitCareWizardParams.name)) submitCareWizardParams: SubmitCareWizardParams,
  ): Promise<Identifiers> {
    const { memberId, redFlag } = submitCareWizardParams;
    const { barriers, ...redFlagParams } = redFlag;
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const { id: redFlagId } = await this.careService.createRedFlag({
      ...redFlagParams,
      memberId,
      journeyId,
    });
    const submittedCarePlans = [];
    await Promise.all(
      barriers.map(async (barrier) => {
        const { carePlans, ...barrierParams } = barrier;
        const { id: barrierId } = await this.careService.createBarrier({
          ...barrierParams,
          memberId,
          journeyId,
          redFlagId,
        });
        await Promise.all(
          carePlans.map(async (carePlan) => {
            const { id: carePlanId } = await this.careService.createCarePlan({
              ...carePlan,
              memberId,
              journeyId,
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
