import { UseInterceptors } from '@nestjs/common';
import {
  Client,
  ErrorType,
  Errors,
  IsValidObjectId,
  LoggerService,
  LoggingInterceptor,
  Roles,
} from '../common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Admission,
  AdmissionService,
  ChangeMemberDnaParams,
  DietaryHelper,
  DietaryMatcher,
  Journey,
  JourneyService,
} from '.';
import { UserRole } from '@argus/hepiusClient';
import { camelCase } from 'lodash';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Journey)
export class JourneyResolver {
  constructor(
    readonly journeyService: JourneyService,
    readonly admissionService: AdmissionService,
    readonly dietaryMatcher: DietaryHelper,
    readonly logger: LoggerService,
  ) {}

  /************************************************************************************************
   *************************************** Member Admission ***************************************
   ************************************************************************************************/
  @Mutation(() => Admission)
  @Roles(UserRole.coach, UserRole.nurse)
  async changeMemberDna(
    @Client('roles') roles,
    @Args(camelCase(ChangeMemberDnaParams.name))
    changeMemberDnaParams: ChangeMemberDnaParams,
  ): Promise<Admission> {
    this.dietaryMatcher.validate(changeMemberDnaParams.dietary);
    return this.admissionService.change(changeMemberDnaParams);
  }

  @Query(() => [Admission])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberAdmissions(
    @Args(
      'memberId',
      { type: () => String, nullable: false },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid), { nullable: true }),
    )
    memberId: string,
  ) {
    return this.admissionService.get(memberId);
  }

  @Query(() => DietaryMatcher)
  @Roles(UserRole.coach, UserRole.nurse)
  async getAdmissionsDietaryMatcher() {
    return this.dietaryMatcher.get();
  }
}
