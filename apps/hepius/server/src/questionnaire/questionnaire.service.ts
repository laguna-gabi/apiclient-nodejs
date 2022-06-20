import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { differenceWith } from 'lodash';
import { Model, Types } from 'mongoose';
import {
  AlertCondition,
  AlertConditionType,
  Answer,
  CreateQuestionnaireParams,
  HealthPersona,
  Item,
  PersonasOptions,
  Questionnaire,
  QuestionnaireAlerts,
  QuestionnaireDocument,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
  QuestionnaireResponseResult,
  QuestionnaireType,
  SubmitQuestionnaireResponseParams,
} from '.';
import {
  Alert,
  AlertService,
  AlertType,
  DismissedAlert,
  DismissedAlertDocument,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnAlertForQRSubmit,
  ItemType,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';
import { Internationalization } from '../providers';
import { JourneyService } from '../journey';

@Injectable()
export class QuestionnaireService extends AlertService {
  private personasOptions = new PersonasOptions();

  constructor(
    @InjectModel(Questionnaire.name)
    private readonly questionnaire: Model<QuestionnaireDocument>,
    @InjectModel(QuestionnaireResponse.name)
    private readonly questionnaireResponse: Model<QuestionnaireResponseDocument> &
      ISoftDelete<QuestionnaireResponseDocument>,
    @InjectModel(DismissedAlert.name)
    readonly dismissAlertModel: Model<DismissedAlertDocument>,
    private readonly journeyService: JourneyService,
    private readonly internationalization: Internationalization,
    readonly logger: LoggerService,
    readonly eventEmitter: EventEmitter2,
  ) {
    super(dismissAlertModel);
  }

  async createQuestionnaire(
    createQuestionnaireParams: CreateQuestionnaireParams,
  ): Promise<Questionnaire> {
    // disable all previous versions of this type
    await this.questionnaire.updateMany(
      { type: createQuestionnaireParams.type, active: true },
      { $set: { active: false } },
    );

    return this.questionnaire.create({
      ...createQuestionnaireParams,
      active: true,
    });
  }

  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaire.find({ active: true });
  }

  async getQuestionnaireById(id: string): Promise<Questionnaire> {
    const questionnaire = await this.questionnaire.findOne({ _id: new Types.ObjectId(id) });
    if (!questionnaire) {
      throw new Error(Errors.get(ErrorType.questionnaireNotFound));
    }
    return questionnaire;
  }

  async submitQuestionnaireResponse(
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams,
  ): Promise<QuestionnaireResponse> {
    // 1. validate answers against the questionnaire
    const questionnaire = await this.questionnaire.findOne({
      _id: new Types.ObjectId(submitQuestionnaireResponseParams.questionnaireId),
    });

    if (!questionnaire) {
      throw new Error(Errors.get(ErrorType.questionnaireNotFound));
    }

    this.validate(submitQuestionnaireResponseParams.answers, questionnaire);

    // 2. save
    const qr = await this.questionnaireResponse.create({
      ...submitQuestionnaireResponseParams,
      questionnaireId: new Types.ObjectId(submitQuestionnaireResponseParams.questionnaireId),
      memberId: new Types.ObjectId(submitQuestionnaireResponseParams.memberId),
      journeyId: new Types.ObjectId(submitQuestionnaireResponseParams.journeyId),
    });

    // 3. upload on-the-fly calculated information
    const out: QuestionnaireResponse = {
      ...this.replaceId(qr.toObject()),
      type: questionnaire.type,
      result: this.buildResult(submitQuestionnaireResponseParams.answers, questionnaire),
    };

    // 4. notify #escalation-support (if needed)
    if (out.result.alert || this.isOverThreshold(questionnaire, out.result.score)) {
      const params: IEventOnAlertForQRSubmit = {
        memberId: submitQuestionnaireResponseParams.memberId,
        score:
          out.result.alert && QuestionnaireAlerts.get(questionnaire.type)
            ? QuestionnaireAlerts.get(questionnaire.type)
            : out.result.score.toString(),
        questionnaireName: questionnaire.shortName,
        questionnaireType: questionnaire.type,
        questionnaireResponseId: qr.id.toString(),
      };
      this.eventEmitter.emit(EventType.onAlertForQRSubmit, params);
    }

    return out;
  }

  async getQuestionnaireResponses({
    memberId,
    journeyId,
  }: {
    memberId: string;
    journeyId: string;
  }): Promise<QuestionnaireResponse[]> {
    const qrs = await this.questionnaireResponse.find({
      memberId: new Types.ObjectId(memberId),
      journeyId: new Types.ObjectId(journeyId),
    });

    // pre-populating results - calculated on-the-fly
    return Promise.all(
      qrs.map(async (qr) => {
        const questionnaire = await this.questionnaire.findById(qr.questionnaireId);

        return {
          ...this.replaceId(qr.toObject()),
          result: this.buildResult(qr.answers, questionnaire),
          type: questionnaire.type,
        };
      }),
    );
  }

  @OnEvent(EventType.onDeletedMember, { async: true })
  async deleteMemberQuestionnaireResponses(params: IEventDeleteMember) {
    await deleteMemberObjects<
      Model<QuestionnaireResponseDocument> & ISoftDelete<QuestionnaireResponseDocument>
    >({
      params,
      model: this.questionnaireResponse,
      logger: this.logger,
      methodName: this.deleteMemberQuestionnaireResponses.name,
      serviceName: QuestionnaireService.name,
    });
  }

  async getQuestionnaireResponseById(id: string): Promise<QuestionnaireResponse> {
    const qr = await this.questionnaireResponse.findOne({ _id: new Types.ObjectId(id) });

    if (qr) {
      // pre-populating results - calculated on-the-fly
      const questionnaire = await this.questionnaire.findById(qr.questionnaireId);

      return {
        ...this.replaceId(qr.toObject()),
        result: this.buildResult(qr.answers, questionnaire),
        type: questionnaire.type,
      };
    }
  }

  async getHealthPersona({
    memberId,
    journeyId,
  }: {
    memberId: string;
    journeyId: string;
  }): Promise<HealthPersona | undefined> {
    const result: QuestionnaireResponse = await this.getLatestQuestionnaireResponse({
      memberId,
      journeyId,
      type: QuestionnaireType.lhp,
    });

    if (result) {
      return this.calculateHealthPersona(result.answers);
    }
  }

  async entityToAlerts(member): Promise<Alert[]> {
    const templates = new Map<string, Questionnaire>();
    const { id: journeyId } = await this.journeyService.getRecent(member.id);
    const qrs = await this.getQuestionnaireResponses({ memberId: member.id, journeyId });

    return Promise.all(
      qrs.map(async (qr) => {
        const template =
          templates.get(qr.questionnaireId.toString()) ||
          (await this.getQuestionnaireById(qr.questionnaireId.toString()));

        templates.set(qr.questionnaireId.toString(), template);

        const results = this.buildResult(qr.answers, template);

        if (
          results.score >= template.notificationScoreThreshold ||
          (results.alert && QuestionnaireAlerts.get(template.type))
        ) {
          return {
            id: `${qr.id}_${AlertType.assessmentSubmitScoreOverThreshold}`,
            type: AlertType.assessmentSubmitScoreOverThreshold,
            date: qr.createdAt,
            text: this.internationalization.getAlerts(
              AlertType.assessmentSubmitScoreOverThreshold,
              {
                member,
                assessmentName: template.shortName,
                assessmentScore:
                  results.alert && QuestionnaireAlerts.get(template.type)
                    ? QuestionnaireAlerts.get(template.type)
                    : results.score.toString(),
              },
            ),
            memberId: member.id,
          } as Alert;
        }
      }),
    );
  }

  private validate(answers: Answer[], questionnaire: Questionnaire) {
    const formatError = (error: string) => {
      return `${Errors.get(ErrorType.questionnaireResponseInvalidResponse)}: ${error}`;
    };

    const diffResult = differenceWith(
      this.findAllRequiredAnswerCodes(questionnaire.items),
      answers,
      (code, answer) => code === answer.code,
    );
    if (diffResult.length >= 1) {
      throw new Error(formatError(`missing required answer codes: ${diffResult.join()}`));
    }

    answers.forEach((answer) => {
      const answerValue = parseInt(answer.value);
      // validate that the answer code exists in questionnaire
      const item = this.findItemByCode(questionnaire.items, answer.code);

      if (!item) {
        throw new Error(
          formatError(`answer with invalid code ${answer.code} - not in questionnaire`),
        );
      }

      // validate that the answer value is consistent with question type and options/range
      switch (item.type) {
        case ItemType.choice:
          if (!item.options.find((option) => option.value === answerValue)) {
            throw new Error(
              formatError(
                `answer for 'choice' type question with invalid value code: ` +
                  `'${answer.code}', value: '${answer.value}'`,
              ),
            );
          }
          break;
        case ItemType.range:
          if (answerValue > item.range.max.value || answerValue < item.range.min.value) {
            throw new Error(
              formatError(
                `answer for 'range' type question with value out of range: ` +
                  `'${answer.code}', value: '${answer.value}'`,
              ),
            );
          }
          break;
      }
    });
  }

  buildResult(answers: Answer[], questionnaire: Questionnaire): QuestionnaireResponseResult {
    let score: number;
    let severity: string;

    if (
      questionnaire.type === QuestionnaireType.gad7 ||
      questionnaire.type === QuestionnaireType.phq9 ||
      questionnaire.type === QuestionnaireType.nps ||
      questionnaire.type === QuestionnaireType.who5
    ) {
      score = answers.length
        ? answers
            .map((answer) => parseInt(answer.value))
            .reduce((valueA, valueB) => {
              return valueA + valueB;
            }) * (questionnaire.scoreFactor || 1)
        : 0;

      severity = questionnaire?.severityLevels.find(
        (severity) => severity.min <= score && severity.max >= score,
      )?.label;
    }

    if (questionnaire.type === QuestionnaireType.lhp) {
      severity = this.calculateHealthPersona(answers);
    }

    return {
      score,
      severity,
      alert: answers.find((answer) => this.isAlertConditionsSatisfied(answer, questionnaire))
        ? true
        : false,
    };
  }

  private isAlertConditionsSatisfied(answer: Answer, questionnaire: Questionnaire): boolean {
    const item = this.findItemByCode(questionnaire.items, answer.code);

    const isSatisfied = (condition: AlertCondition): boolean => {
      switch (condition.type) {
        case AlertConditionType.equal:
          return answer.value === condition.value;
        case AlertConditionType.lte:
          return parseInt(answer.value) <= parseInt(condition.value);
        case AlertConditionType.gte:
          return parseInt(answer.value) >= parseInt(condition.value);
      }

      return false;
    };

    return item?.alertCondition?.find(isSatisfied) ? true : false;
  }

  private findItemByCode(items: Item[], code: string): Item {
    for (const item of items) {
      if (item.code === code) {
        return item;
      }
      if (item.type === ItemType.group) {
        return this.findItemByCode(item.items, code);
      }
    }
  }

  private findAllRequiredAnswerCodes(items: Item[]): string[] {
    const codes = [];
    for (const item of items) {
      if (item.type === ItemType.group) {
        codes.push(...this.findAllRequiredAnswerCodes(item.items));
      } else if (item.required) {
        codes.push(item.code);
      }
    }
    return codes;
  }

  private async getLatestQuestionnaireResponse({
    memberId,
    journeyId,
    type,
  }: {
    memberId: string;
    journeyId: string;
    type: QuestionnaireType;
  }): Promise<QuestionnaireResponse | undefined> {
    const result = await this.questionnaireResponse.aggregate([
      {
        $match: {
          memberId: new Types.ObjectId(memberId),
          journeyId: new Types.ObjectId(journeyId),
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          localField: 'questionnaireId',
          from: 'questionnaires',
          foreignField: '_id',
          as: 'q',
        },
      },
      { $unwind: { path: '$q' } },
      { $match: { 'q.type': type } },
    ]);

    return result.length > 0 ? result[0] : null;
  }

  private calculateHealthPersona(answers: Answer[]): HealthPersona {
    const skills = answers[0].value;
    const motivation = answers[1].value;

    return [...this.personasOptions.get()].find(
      ([key, value]) => key && value.q1.includes(skills) && value.q2.includes(motivation),
    )?.[0];
  }

  // Description: return true if score crosses a threshold
  // Note: if we have a `reverse` flag set to true we want to check if score is
  // lower than threshold
  private isOverThreshold(questionnaire: Questionnaire, score: number): boolean {
    if (questionnaire.notificationScoreThreshold) {
      if (questionnaire.notificationScoreThresholdReverse) {
        return score < questionnaire.notificationScoreThreshold;
      } else {
        return score >= questionnaire.notificationScoreThreshold;
      }
    }

    return false;
  }
}
