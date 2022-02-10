import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BaseService,
  ErrorType,
  Errors,
  EventType,
  IEventOnAlertForQRSubmit,
  ItemType,
  LoggerService,
} from '../common';
import {
  AlertCondition,
  AlertConditionType,
  Answer,
  CreateQuestionnaireParams,
  Item,
  Questionnaire,
  QuestionnaireAlerts,
  QuestionnaireDocument,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
  QuestionnaireResponseResult,
  QuestionnaireType,
  SubmitQuestionnaireResponseParams,
} from '.';
import { formatEx } from '@lagunahealth/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class QuestionnaireService extends BaseService {
  constructor(
    @InjectModel(Questionnaire.name)
    private readonly questionnaire: Model<QuestionnaireDocument>,

    @InjectModel(QuestionnaireResponse.name)
    private readonly questionnaireResponse: Model<QuestionnaireResponseDocument>,
    readonly logger: LoggerService,
    readonly eventEmitter: EventEmitter2,
  ) {
    super();
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
      createdBy: createQuestionnaireParams.createdBy
        ? new Types.ObjectId(createQuestionnaireParams.createdBy)
        : undefined,
    });
  }

  async getActiveQuestionnaires(): Promise<Questionnaire[]> {
    return this.questionnaire.find({ active: true });
  }

  async getQuestionnaireById(id: string): Promise<Questionnaire> {
    return this.questionnaire.findOne({ _id: new Types.ObjectId(id) });
  }

  async submitQuestionnaireResponse(
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams,
  ): Promise<QuestionnaireResponse> {
    // 1. validate answers against the template
    const template = await this.questionnaire.findOne({
      _id: new Types.ObjectId(submitQuestionnaireResponseParams.questionnaireId),
    });

    if (!template) {
      throw new Error(Errors.get(ErrorType.questionnaireResponseInvalidQuestionnaireIdNotFound));
    }

    try {
      this.validate(submitQuestionnaireResponseParams.answers, template);
    } catch (ex) {
      this.logger.error(
        submitQuestionnaireResponseParams,
        QuestionnaireService.name,
        this.submitQuestionnaireResponse.name,
        formatEx(ex),
      );
      throw new Error(Errors.get(ErrorType.questionnaireResponseInvalidResponse));
    }

    // 2. save
    const qr = await this.questionnaireResponse.create({
      ...submitQuestionnaireResponseParams,
      questionnaireId: new Types.ObjectId(submitQuestionnaireResponseParams.questionnaireId),
      memberId: new Types.ObjectId(submitQuestionnaireResponseParams.memberId),
      createdBy: new Types.ObjectId(submitQuestionnaireResponseParams.createdBy),
    });

    // 3. upload on-the-fly calculated information
    const out: QuestionnaireResponse = {
      ...this.replaceId(qr.toObject()),
      type: template.type,
      result: this.buildResult(submitQuestionnaireResponseParams.answers, template),
    };

    // 4. notify #escalation-support (if needed)
    if (
      out.result.alert ||
      (template.notificationScoreThreshold &&
        out.result.score >= template.notificationScoreThreshold)
    ) {
      const params: IEventOnAlertForQRSubmit = {
        memberId: submitQuestionnaireResponseParams.memberId,
        score:
          out.result.alert && QuestionnaireAlerts.get(template.type)
            ? QuestionnaireAlerts.get(template.type)
            : out.result.score.toString(),
        questionnaireName: template.shortName,
      };
      this.eventEmitter.emit(EventType.onAlertForQRSubmit, params);
    }

    return out;
  }

  async getQuestionnaireResponseByMemberId(memberId: string): Promise<QuestionnaireResponse[]> {
    const qrs = await this.questionnaireResponse.find({ memberId: new Types.ObjectId(memberId) });

    // pre-populating results - calculated on-the-fly
    return Promise.all(
      qrs.map(async (qr) => {
        const template = await this.questionnaire.findById(qr.questionnaireId);

        return {
          ...this.replaceId(qr.toObject()),
          result: this.buildResult(qr.answers, template),
          type: template.type,
        };
      }),
    );
  }

  async getQuestionnaireResponseById(id: string): Promise<QuestionnaireResponse> {
    const qr = await this.questionnaireResponse.findOne({ _id: new Types.ObjectId(id) });

    if (qr) {
      // pre-populating results - calculated on-the-fly
      const template = await this.questionnaire.findById(qr.questionnaireId);

      return {
        ...this.replaceId(qr.toObject()),
        result: this.buildResult(qr.answers, template),
        type: template.type,
      };
    }
  }

  private validate(answers: Answer[], template: Questionnaire) {
    answers.forEach((answer) => {
      const answerValue = parseInt(answer.value);
      // validate that the answer code exists in template
      const item = this.findItemByCode(template.items, answer.code);

      if (!item) {
        throw new Error(`answer with invalid code ${answer.code} - not in template`);
      }

      // validate that the answer value is consistent with question type and options/range
      switch (item.type) {
        case ItemType.choice:
          if (!item.options.find((option) => option.value === answerValue)) {
            throw new Error(
              // eslint-disable-next-line max-len
              `answer for 'choice' type question with invalid value code: '${answer.code}', value: '${answer.value}'`,
            );
          }
          break;
        case ItemType.range:
          if (answerValue > item.range.max.value || answerValue < item.range.min.value) {
            throw new Error(
              // eslint-disable-next-line max-len
              `answer for 'range' type question with value out of range: '${answer.code}', value: '${answer.value}'`,
            );
          }
          break;
      }
    });
  }

  private buildResult(answers: Answer[], template: Questionnaire): QuestionnaireResponseResult {
    let score: number;
    let severity: string;

    if (template.type === QuestionnaireType.gad7 || template.type === QuestionnaireType.phq9) {
      score = answers
        .map((answer) => parseInt(answer.value))
        .reduce((valueA, valueB) => {
          return valueA + valueB;
        });

      severity = template?.severityLevels.find(
        (severity) => severity.min <= score && severity.max >= score,
      )?.label;
    }

    return {
      score,
      severity,
      alert: answers.find((answer) => this.isAlertConditionsSatisfied(answer, template))
        ? true
        : false,
    };
  }

  private isAlertConditionsSatisfied(answer: Answer, template: Questionnaire): boolean {
    const item = this.findItemByCode(template.items, answer.code);

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
}
