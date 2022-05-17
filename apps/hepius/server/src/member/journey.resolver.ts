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
  GraduateMemberParams,
  Journey,
  JourneyService,
  MemberService,
  UpdateJourneyParams,
} from '.';
import { UserRole } from '@argus/hepiusClient';
import { camelCase } from 'lodash';
import { Platform } from '@argus/pandora';
import { CognitoService } from '../providers';

@UseInterceptors(LoggingInterceptor)
@Resolver(() => Journey)
export class JourneyResolver {
  constructor(
    readonly journeyService: JourneyService,
    readonly memberService: MemberService,
    readonly admissionService: AdmissionService,
    readonly dietaryMatcher: DietaryHelper,
    private readonly cognitoService: CognitoService,
    readonly logger: LoggerService,
  ) {}

  /************************************************************************************************
   ******************************************** Journey *******************************************
   ************************************************************************************************/
  @Mutation(() => Journey)
  @Roles(UserRole.coach, UserRole.nurse)
  async updateJourney(
    @Args(camelCase(UpdateJourneyParams.name)) params: UpdateJourneyParams,
  ): Promise<Journey> {
    return this.journeyService.update(params);
  }

  @Query(() => [Journey])
  @Roles(UserRole.coach, UserRole.nurse)
  async getJourneys(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<Journey[]> {
    return this.journeyService.getAll({ memberId });
  }

  @Query(() => Journey)
  @Roles(UserRole.coach, UserRole.nurse)
  async getJourney(
    @Args('id', { type: () => String }, new IsValidObjectId(Errors.get(ErrorType.journeyIdInvalid)))
    id: string,
  ): Promise<Journey> {
    return this.journeyService.get(id);
  }

  @Query(() => Journey)
  @Roles(UserRole.coach, UserRole.nurse)
  async getActiveJourney(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<Journey> {
    return this.journeyService.getActive(memberId);
  }

  @Mutation(() => Boolean, { nullable: true })
  @Roles(UserRole.admin)
  async graduateMember(
    @Args(camelCase(GraduateMemberParams.name))
    graduateMemberParams: GraduateMemberParams,
  ) {
    const member = await this.memberService.get(graduateMemberParams.id);
    const journeys = await this.journeyService.getAll({ memberId: graduateMemberParams.id });
    const memberConfig = await this.memberService.getMemberConfig(graduateMemberParams.id);
    if (journeys[0].isGraduated !== graduateMemberParams.isGraduated) {
      if (memberConfig.platform !== Platform.web) {
        if (graduateMemberParams.isGraduated) {
          await this.cognitoService.disableClient(member.deviceId);
        } else {
          await this.cognitoService.enableClient(member.deviceId);
        }
      }
      await this.journeyService.graduate(graduateMemberParams);
    }
  }

  /************************************************************************************************
   ****************************************** Admission *******************************************
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
