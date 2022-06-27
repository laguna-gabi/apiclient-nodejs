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
  AceStrategy,
  Client,
  ErrorType,
  Errors,
  EventType,
  IEventUpdateHealthPersona,
  IEventUpdateRelatedEntity,
  IsValidObjectId,
  LoggingInterceptor,
  MemberIdParam,
  MemberIdParamType,
  MemberUserRouteInterceptor,
  RelatedEntityType,
  Roles,
} from '../common';
import { JourneyService } from '../journey';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class QuestionnaireResolver {
  constructor(
    private readonly questionnaireService: QuestionnaireService,
    private readonly journeyService: JourneyService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => Questionnaire)
  @Roles(UserRole.lagunaAdmin)
  @Ace({ strategy: AceStrategy.rbac })
  async createQuestionnaire(
    @Args(camelCase(CreateQuestionnaireParams.name), { type: () => CreateQuestionnaireParams })
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    return this.questionnaireService.createQuestionnaire(createQuestionnaireParams);
  }

  @Query(() => [Questionnaire])
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaireService.getActiveQuestionnaires();
  }

  @Query(() => Questionnaire)
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member, UserRole.coach)
  @Ace({ strategy: AceStrategy.rbac })
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({ entityName: EntityName.member, idLocator: `memberId` })
  async getMemberQuestionnaireResponses(
    @Args(
      'memberId',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.memberIdInvalid)),
    )
    memberId: string,
  ): Promise<QuestionnaireResponse[]> {
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    return this.questionnaireService.getQuestionnaireResponses({ memberId, journeyId });
  }

  @Query(() => QuestionnaireResponse, { nullable: true })
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, UserRole.coach)
  @Ace({
    entityName: EntityName.questionnaireresponse,
    idLocator: `id`,
    entityMemberIdLocator: 'memberId',
  })
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
  @Roles(UserRole.lagunaCoach, UserRole.lagunaNurse, MemberRole.member, UserRole.coach)
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
    const { relatedEntity, ...submitParams } = submitQuestionnaireResponseParams;
    const questionnaire = await this.questionnaireService.getQuestionnaireById(
      submitParams.questionnaireId,
    );

    if (roles.includes(MemberRole.member) && !questionnaire.isAssignableToMember) {
      throw new Error(Errors.get(ErrorType.questionnaireNotAssignableToMember));
    }

    const { memberId } = submitParams;
    const { id: journeyId } = await this.journeyService.getRecent(memberId);
    const result = await this.questionnaireService.submitQuestionnaireResponse({
      ...submitParams,
      journeyId,
    });

    if (relatedEntity) {
      const eventParams: IEventUpdateRelatedEntity = {
        destEntity: relatedEntity,
        sourceEntity: { type: RelatedEntityType.questionnaireResponse, id: result.id },
      };
      this.eventEmitter.emit(EventType.onUpdateRelatedEntity, eventParams);
    }

    if (result.type === QuestionnaireType.lhp) {
      const healthPersona = await this.questionnaireService.getHealthPersona({
        memberId,
        journeyId,
      });
      const eventUpdateHealthPersonaParams: IEventUpdateHealthPersona = { memberId, healthPersona };
      this.eventEmitter.emit(EventType.onUpdateHealthPersona, eventUpdateHealthPersonaParams);
    }

    return result;
  }
}
