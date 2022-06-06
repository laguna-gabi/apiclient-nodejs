import { MemberRole, UserRole } from '@argus/hepiusClient';
import { EntityName } from '@argus/pandora';
import { UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  CreateQuestionnaireParams,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireService,
  QuestionnaireType,
  SubmitQuestionnaireResponseParams,
} from '.';
import {
  Ace,
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventUpdateHealthPersona,
  IsValidObjectId,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  Roles,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class QuestionnaireResolver {
  constructor(
    private readonly questionnaireService: QuestionnaireService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => Questionnaire)
  @Roles(UserRole.lagunaAdmin)
  async createQuestionnaire(
    @Args(camelCase(CreateQuestionnaireParams.name), { type: () => CreateQuestionnaireParams })
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    return this.questionnaireService.createQuestionnaire({ ...createQuestionnaireParams });
  }

  @Query(() => [Questionnaire])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaireService.getActiveQuestionnaires();
  }

  @Query(() => Questionnaire)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getQuestionnaire(
    @Client('roles') roles,
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.questionnaireInvalidIdCode)),
    )
    id: string,
  ): Promise<Questionnaire> {
    const questionnaire = await this.questionnaireService.getQuestionnaireById(id);
    if (roles.includes(MemberRole.member) && !questionnaire.isAssignableToMember) {
      throw new Error(Errors.get(ErrorType.questionnaireNotAssignableToMember));
    }
    return questionnaire;
  }

  @Query(() => [QuestionnaireResponse])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getMemberQuestionnaireResponses(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<QuestionnaireResponse[]> {
    return this.questionnaireService.getQuestionnaireResponseByMemberId(memberId);
  }

  @Query(() => QuestionnaireResponse, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse)
  async getQuestionnaireResponse(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.questionnaireResponseInvalidIdCode)),
    )
    id: string,
  ): Promise<QuestionnaireResponse> {
    return this.questionnaireService.getQuestionnaireResponseById(id);
  }

  @Mutation(() => QuestionnaireResponse)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  @MemberIdParam(MemberIdParamType.memberId)
  @UseInterceptors(MemberUserRouteInterceptor)
  async submitQuestionnaireResponse(
    @Client('roles') roles,
    @Args(camelCase(SubmitQuestionnaireResponseParams.name), {
      type: () => SubmitQuestionnaireResponseParams,
    })
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams,
  ): Promise<QuestionnaireResponse> {
    const questionnaire = await this.questionnaireService.getQuestionnaireById(
      submitQuestionnaireResponseParams.questionnaireId,
    );

    if (roles.includes(MemberRole.member) && !questionnaire.isAssignableToMember) {
      throw new Error(Errors.get(ErrorType.questionnaireNotAssignableToMember));
    }

    const result = await this.questionnaireService.submitQuestionnaireResponse(
      submitQuestionnaireResponseParams,
    );

    if (result.type === QuestionnaireType.lhp) {
      const { memberId } = submitQuestionnaireResponseParams;
      const healthPersona = await this.questionnaireService.getHealthPersona({ memberId });
      const eventUpdateHealthPersonaParams: IEventUpdateHealthPersona = { memberId, healthPersona };
      this.eventEmitter.emit(EventType.onUpdateHealthPersona, eventUpdateHealthPersonaParams);
    }

    return result;
  }
}
