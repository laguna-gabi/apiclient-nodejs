import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { differenceWith, intersection } from 'lodash';
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
  ReadinessQuestionGroup,
  SubmitQuestionnaireResponseParams,
} from '.';
import {
  Alert,
  AlertService,
  AlertType,
  CommandType,
  DismissedAlert,
  DismissedAlertDocument,
  ErrorType,
  Errors,
  EventType,
  IEventDeleteMember,
  IEventOnAlertForQRSubmit,
  IEventOnQRSubmit,
  ItemType,
  LoggerService,
  deleteMemberObjects,
} from '../common';
import { ISoftDelete } from '../db';
import { Internationalization } from '../providers';
import { JourneyService } from '../journey';
import { differenceInYears } from 'date-fns';

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

  async getQuestionnaireByType(questionnaireType: QuestionnaireType): Promise<Questionnaire> {
    return this.questionnaire.findOne({ active: true, type: questionnaireType });
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
    const questionnaireResponse: QuestionnaireResponse = {
      ...this.replaceId(qr.toObject()),
      type: questionnaire.type,
      result: await this.buildResult(
        submitQuestionnaireResponseParams.answers,
        questionnaire,
        qr.memberId.toString(),
      ),
    };

    // 4. notify #escalation-support (if needed)
    if (
      questionnaireResponse.result?.alert ||
      this.isOverThreshold(questionnaire, questionnaireResponse.result?.score)
    ) {
      const params: IEventOnAlertForQRSubmit = {
        memberId: submitQuestionnaireResponseParams.memberId,
        score:
          questionnaireResponse.result.alert && QuestionnaireAlerts.get(questionnaire.type)
            ? QuestionnaireAlerts.get(questionnaire.type)
            : questionnaireResponse.result.score.toString(),
        questionnaireName: questionnaire.shortName,
        questionnaireType: questionnaire.type,
        questionnaireResponseId: qr.id.toString(),
      };
      this.eventEmitter.emit(EventType.onAlertForQRSubmit, params);
    }

    // 4. emit an onSubmit event
    const onQRSubmitParams: IEventOnQRSubmit = {
      memberId: submitQuestionnaireResponseParams.memberId,
      journeyId: submitQuestionnaireResponseParams.journeyId,
      questionnaireName: questionnaire.shortName,
      questionnaireType: questionnaire.type,
      questionnaireResponse,
    };
    this.eventEmitter.emit(EventType.onQRSubmit, onQRSubmitParams);

    return questionnaireResponse;
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
          result: await this.buildResult(qr.answers, questionnaire, qr.memberId.toString()),
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
        result: await this.buildResult(qr.answers, questionnaire, qr.memberId.toString()),
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

        const results = await this.buildResult(qr.answers, template, qr.memberId.toString());

        if (
          this.isOverThreshold(template, results?.score) ||
          (results?.alert && QuestionnaireAlerts.get(template.type))
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
          if (!item.options.find((option) => option.value === +answer.value)) {
            throw new Error(
              formatError(
                `answer for 'choice' type question with invalid value code: ` +
                  `'${answer.code}', value: '${answer.value}'`,
              ),
            );
          }
          break;
        case ItemType.multiChoice:
          const values = answer.value.split(',');
          values.forEach((values) => {
            if (!item.options.find((option) => option.value === +values)) {
              throw new Error(
                formatError(
                  `answer for 'multiChoice' type question with invalid value code: ` +
                    `'${answer.code}', value: '${values}'`,
                ),
              );
            }
          });
          break;
        case ItemType.range:
          if (+answer.value > item.range.max.value || +answer.value < item.range.min.value) {
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

  async buildResult(
    answers: Answer[],
    questionnaire: Questionnaire,
    memberId: string,
  ): Promise<QuestionnaireResponseResult> {
    if (questionnaire.buildResult) {
      switch (questionnaire.type) {
        case QuestionnaireType.rcqtv:
          return this.rcqtvBuildResults(answers);
        case QuestionnaireType.lhp:
          return this.lhpBuildResults(answers, questionnaire);
        case QuestionnaireType.sdoh:
          return this.sdohBuildResults(memberId, answers);
        default:
          return this.defaultBuildResults(answers, questionnaire);
      }
    }
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

    return item?.alertCondition?.find(isSatisfied) !== undefined;
  }

  private findItemByCode(items: Item[], code: string): Item {
    for (const item of items) {
      if (item.code === code) {
        return item;
      }
      if (item.type === ItemType.group) {
        const ret = this.findItemByCode(item.items, code);
        if (ret) return ret;
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
        return score <= questionnaire.notificationScoreThreshold;
      } else {
        return score >= questionnaire.notificationScoreThreshold;
      }
    }

    return false;
  }

  // Description: default score, severity label and alert calculation
  private defaultBuildResults(
    answers: Answer[],
    questionnaire: Questionnaire,
  ): QuestionnaireResponseResult {
    const score = answers.length
      ? answers
          .map((answer) => parseInt(answer.value))
          .reduce((valueA, valueB) => {
            return valueA + valueB;
          }) * (questionnaire.scoreFactor || 1)
      : 0;

    const severity = questionnaire?.severityLevels.find(
      (severity) => severity.min <= score && severity.max >= score,
    )?.label;

    return {
      score,
      severity,
      alert:
        answers.find((answer) => this.isAlertConditionsSatisfied(answer, questionnaire)) !==
        undefined,
    };
  }

  // Description: custom score, severity label and alert calculation for LHP type questionnaire
  private lhpBuildResults(
    answers: Answer[],
    questionnaire: Questionnaire,
  ): QuestionnaireResponseResult {
    return {
      ...this.defaultBuildResults(answers, questionnaire),
      severity: this.calculateHealthPersona(answers),
    };
  }

  /** Description: custom score, severity label and alert calculation for RCQ-TV type questionnaire
   * {@link: https://app.shortcut.com/laguna-health/story/5598/support-readiness-to-change-questionnaire}
   */
  private rcqtvBuildResults(answers: Answer[]): QuestionnaireResponseResult {
    const groups = new Map<
      string,
      {
        questions: string[];
        priority?: number;
        totalScore: number;
        factor: number; // factor value for total score in the case where 1 out of 4 questions is missing
        answered: number; // number of answered question in group (0-4)
        invalid: boolean; // `true` if less than 3 questions are answered in this group
      }
    >([
      [
        ReadinessQuestionGroup.Precontemplation,
        {
          priority: 0,
          questions: ['q1', 'q3', 'q6', 'q10'],
          totalScore: 0,
          factor: 1,
          answered: 0,
          invalid: true,
        },
      ],
      [
        ReadinessQuestionGroup.Contemplation,
        {
          priority: 1,
          questions: ['q2', 'q4', 'q7', 'q11'],
          totalScore: 0,
          factor: 1,
          answered: 0,
          invalid: true,
        },
      ],
      [
        ReadinessQuestionGroup.Action,
        {
          priority: 2,
          questions: ['q5', 'q8', 'q9', 'q12'],
          totalScore: 0,
          factor: 1,
          answered: 0,
          invalid: true,
        },
      ],
    ]);

    let foundInvalidGroup = false;
    // calculate total score per group (note: if there's no answer it is considered as `0` value - `Unsure` )
    groups.forEach((value, key) => {
      answers.forEach((answer) => {
        if (value.questions.includes(answer.code)) {
          groups.get(key).totalScore += +answer.value;
          groups.get(key).answered++;
          groups.get(key).invalid = groups.get(key).answered < 3;
          groups.get(key).factor = groups.get(key).answered === 3 ? 4 / 3 : 1;
        }
      });

      // once we completed a group scan and it is marked as invalid we can exit with 'Invalid' severity label
      if (value.invalid) {
        foundInvalidGroup = true;
        return;
      }
    });

    if (foundInvalidGroup) {
      return { severity: ReadinessQuestionGroup.Invalid };
    }

    // pick a severity - group with highest total score should prevail (if two groups have the same score the `weight` of the group should determine the prevailing group)
    let selectedGroup;

    groups.forEach((value, key) => {
      if (
        !selectedGroup ||
        value.totalScore * value.factor > selectedGroup.totalScore * selectedGroup.factor ||
        (value.totalScore * value.factor === selectedGroup.totalScore * selectedGroup.factor &&
          selectedGroup.priority < value.priority)
      ) {
        selectedGroup = { ...value, category: key };
      }
    });

    return {
      score: selectedGroup.totalScore * selectedGroup.factor,
      severity: selectedGroup.category,
    };
  }

  /** Description: custom score, severity label and alert calculation for SDoH type questionnaire
   * {@link: https://app.shortcut.com/laguna-health/story/5623/sdoh-assessment}
   */
  private async sdohBuildResults(
    memberId: string,
    answers: Answer[],
  ): Promise<QuestionnaireResponseResult> {
    let score = 0;

    const flaggedOptions = new Map<string, number[]>([
      ['q1', [1, 2]],
      ['q2', [1, 2, 3, 4, 5, 6, 7]],
      ['q3', [0]],
      ['q8', [2, 3]],
      ['q9', [3, 4]],
    ]); // a selected 1 or more flagged options will count as `1` for score

    const scoreByValue = ['q4', 'q5', 'q6', 'q7'];

    // 1. if answer code is a `scoreByValue` type we add answer.value to score
    // 2. if answer value(s) has an intersect with flagged options we increment the score
    answers.forEach((answer) => {
      if (scoreByValue.includes(answer.code)) {
        score += +answer.value;
      } else if (
        intersection(
          answer.value.split(',').map((value) => +value),
          flaggedOptions.get(answer.code),
        ).length
      ) {
        score++;
      }
    });

    // 3. special score calculation for `Physical Activity`
    const [member] = await this.eventEmitter.emitAsync(CommandType.getMember, {
      memberId: memberId.toString(),
    });

    const age = differenceInYears(new Date(), Date.parse(member.dateOfBirth));

    const physicalActivityDaysAnswer = answers.find((answer) => answer.code === 'q10');
    const physicalActivityMinsAnswer = answers.find((answer) => answer.code === 'q11');
    if (physicalActivityDaysAnswer && physicalActivityMinsAnswer) {
      if (
        (6 <= age && age <= 17 && +physicalActivityMinsAnswer.value < 60) ||
        (18 <= age && +physicalActivityDaysAnswer.value * +physicalActivityMinsAnswer.value < 150)
      ) {
        score++;
      }
    }

    return {
      score,
    };
  }
}
