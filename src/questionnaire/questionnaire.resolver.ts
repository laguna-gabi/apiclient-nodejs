import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import {
  CreateQuestionnaireParams,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireService,
  SubmitQuestionnaireResponseParams,
} from '.';
import { Client, LoggingInterceptor, Roles, UserRole } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class QuestionnaireResolver {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  @Mutation(() => Questionnaire)
  @Roles(UserRole.admin)
  async createQuestionnaire(
    @Client('_id') userId: string,
    @Args(camelCase(CreateQuestionnaireParams.name), { type: () => CreateQuestionnaireParams })
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    return this.questionnaireService.createQuestionnaire({
      ...createQuestionnaireParams,
      createdBy: userId,
    });
  }

  @Query(() => [Questionnaire])
  @Roles(UserRole.coach, UserRole.nurse)
  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaireService.getActiveQuestionnaires();
  }

  @Query(() => Questionnaire, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getQuestionnaire(@Args('id', { type: () => String }) id: string): Promise<Questionnaire> {
    return this.questionnaireService.getQuestionnaireById(id);
  }

  @Query(() => [QuestionnaireResponse])
  @Roles(UserRole.coach, UserRole.nurse)
  async getMemberQuestionnaireResponses(
    @Args('memberId', { type: () => String }) memberId: string,
  ): Promise<QuestionnaireResponse[]> {
    return this.questionnaireService.getQuestionnaireResponseByMemberId(memberId);
  }

  @Query(() => QuestionnaireResponse, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getQuestionnaireResponse(
    @Args('id', { type: () => String }) id: string,
  ): Promise<QuestionnaireResponse> {
    return this.questionnaireService.getQuestionnaireResponseById(id);
  }

  @Mutation(() => QuestionnaireResponse)
  @Roles(UserRole.coach, UserRole.nurse)
  async submitQuestionnaireResponse(
    @Client('_id') userId: string,
    @Args(camelCase(SubmitQuestionnaireResponseParams.name), {
      type: () => SubmitQuestionnaireResponseParams,
    })
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams,
  ): Promise<QuestionnaireResponse> {
    return this.questionnaireService.submitQuestionnaireResponse({
      ...submitQuestionnaireResponseParams,
      createdBy: userId,
    });
  }
}
