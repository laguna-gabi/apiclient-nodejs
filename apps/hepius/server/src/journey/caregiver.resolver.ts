import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Caregiver, MemberRole, UserRole } from '@argus/hepiusClient';
import {
  Ace,
  Client,
  ErrorType,
  Errors,
  IsValidObjectId,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  Roles,
} from '../common';
import { EntityName } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import {
  AddCaregiverParams,
  CaregiverService,
  Journey,
  JourneyService,
  UpdateCaregiverParams,
} from '.';
import { camelCase } from 'lodash';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Journey)
export class CaregiverResolver {
  constructor(
    readonly journeyService: JourneyService,
    readonly caregiverService: CaregiverService,
  ) {}

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  async addCaregiver(
    @Args(camelCase(AddCaregiverParams.name), { type: () => AddCaregiverParams })
    addCaregiverParams: AddCaregiverParams,
  ): Promise<Caregiver> {
    const { id: journeyId } = await this.journeyService.getRecent(addCaregiverParams.memberId);
    return this.caregiverService.addCaregiver({ ...addCaregiverParams, journeyId });
  }

  @Mutation(() => Boolean)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.caregiver, idLocator: `id`, entityMemberIdLocator: 'memberId' })
  async deleteCaregiver(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.caregiverIdInvalid)),
    )
    id: string,
    @Client('_id') deletedBy: string,
  ): Promise<boolean | never> {
    const caregiver = await this.caregiverService.getCaregiver(id);

    if (caregiver) {
      await this.caregiverService.deleteCaregiver(id, deletedBy);
    }

    return true;
  }

  @Mutation(() => Caregiver)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  async updateCaregiver(
    @Args(camelCase(UpdateCaregiverParams.name), { type: () => UpdateCaregiverParams })
    updateCaregiverParams: UpdateCaregiverParams,
  ): Promise<Caregiver> {
    const { id: journeyId } = await this.journeyService.getRecent(updateCaregiverParams.memberId);
    return this.caregiverService.updateCaregiver({ ...updateCaregiverParams, journeyId });
  }

  @Query(() => [Caregiver])
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  @Roles(MemberRole.member, UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getCaregivers(
    @Args(
      'memberId',
      { type: () => String, nullable: true },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId?: string,
  ): Promise<Caregiver[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.caregiverService.getCaregivers({ memberId, journeyId });
  }
}
