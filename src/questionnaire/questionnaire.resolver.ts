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
  ErrorType,
  Errors,
  EventType,
  IEventUpdateHealthPersona,
  IsValidObjectId,
  LoggingInterceptor,
  Roles,
  UserRole,
} from '../common';

@UseInterceptors(LoggingInterceptor)
@Resolver()
export class QuestionnaireResolver {
  constructor(
    private readonly questionnaireService: QuestionnaireService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => Questionnaire)
  @Roles(UserRole.admin)
  async createQuestionnaire(
    @Args(camelCase(CreateQuestionnaireParams.name), { type: () => CreateQuestionnaireParams })
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    return this.questionnaireService.createQuestionnaire({ ...createQuestionnaireParams });
  }

  @Query(() => [Questionnaire])
  @Roles(UserRole.coach, UserRole.nurse)
  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaireService.getActiveQuestionnaires();
  }

  @Query(() => Questionnaire, { nullable: true })
  @Roles(UserRole.coach, UserRole.nurse)
  async getQuestionnaire(
    @Args(
      'id',
      { type: () => String },
      new IsValidObjectId(Errors.get(ErrorType.questionnaireInvalidIdCode)),
    )
    id: string,
  ): Promise<Questionnaire> {
    return this.questionnaireService.getQuestionnaireById(id);
  }

  @Query(() => [QuestionnaireResponse])
  @Roles(UserRole.coach, UserRole.nurse)
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
  @Roles(UserRole.coach, UserRole.nurse)
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
  @Roles(UserRole.coach, UserRole.nurse)
  async submitQuestionnaireResponse(
    @Args(camelCase(SubmitQuestionnaireResponseParams.name), {
      type: () => SubmitQuestionnaireResponseParams,
    })
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams,
  ): Promise<QuestionnaireResponse> {
    const result = await this.questionnaireService.submitQuestionnaireResponse({
      ...submitQuestionnaireResponseParams,
    });

    if (result.type === QuestionnaireType.lhp) {
      const { memberId } = submitQuestionnaireResponseParams;
      const healthPersona = await this.questionnaireService.getHealthPersona({ memberId });
      const eventUpdateHealthPersonaParams: IEventUpdateHealthPersona = { memberId, healthPersona };
      this.eventEmitter.emit(EventType.onUpdateHealthPersona, eventUpdateHealthPersonaParams);
    }

    return result;
  }
}
