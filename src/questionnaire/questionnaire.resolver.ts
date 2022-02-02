import { UseInterceptors } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { camelCase } from 'lodash';
import { CreateQuestionnaireParams, Questionnaire, QuestionnaireService } from '.';
import { LoggingInterceptor, Roles, UserRole } from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class QuestionnaireResolver {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  @Mutation(() => Questionnaire)
  @Roles(UserRole.admin)
  async createQuestionnaire(
    @Args(camelCase(CreateQuestionnaireParams.name), { type: () => CreateQuestionnaireParams })
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    return this.questionnaireService.create(createQuestionnaireParams);
  }

  @Query(() => [Questionnaire])
  @Roles(UserRole.coach, UserRole.nurse)
  async getQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaireService.get();
  }
}
