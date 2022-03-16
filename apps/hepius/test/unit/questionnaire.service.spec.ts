import { mockLogger, mockProcessWarnings } from '@argus/pandora';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { lorem } from 'faker';
import { Model, Types, model } from 'mongoose';
import { buildGAD7Questionnaire, buildLHPQuestionnaire } from '../../cmd/static';
import { ErrorType, Errors, EventType, ItemType, LoggerService } from '../../src/common';
import {
  AlertConditionType,
  CreateQuestionnaireParams,
  HealthPersona,
  PersonasOptions,
  Questionnaire,
  QuestionnaireDocument,
  QuestionnaireDto,
  QuestionnaireModule,
  QuestionnaireResponse,
  QuestionnaireResponseDocument,
  QuestionnaireResponseDto,
  QuestionnaireService,
  QuestionnaireType,
} from '../../src/questionnaire';
import {
  checkDelete,
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateQuestionnaireParams,
  generateId,
  generateObjectId,
  mockGenerateQuestionnaire,
  mockGenerateQuestionnaireItem,
} from '../../test';

describe('QuestionnaireService', () => {
  let module: TestingModule;
  let service: QuestionnaireService;
  let eventEmitter: EventEmitter2;
  let spyOnEventEmitter: jest.SpyInstance;
  let questionnaireModel: Model<QuestionnaireDocument>;
  let questionnaireResponseModel: Model<QuestionnaireResponseDocument>;
  let phq9TypeTemplate: Questionnaire;
  let who5TypeTemplate: Questionnaire;
  let npsTypeTemplate: Questionnaire;
  let lhpTypeTemplate: Questionnaire;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    service = module.get<QuestionnaireService>(QuestionnaireService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    spyOnEventEmitter = jest.spyOn(eventEmitter, 'emit');

    questionnaireModel = model<QuestionnaireDocument>(Questionnaire.name, QuestionnaireDto);
    questionnaireResponseModel = model<QuestionnaireResponseDocument>(
      QuestionnaireResponse.name,
      QuestionnaireResponseDto,
    );
    mockLogger(module.get<LoggerService>(LoggerService));

    phq9TypeTemplate = await service.createQuestionnaire(
      generateCreateQuestionnaireParams({
        type: QuestionnaireType.phq9,
        items: [
          {
            code: 'q1',
            type: ItemType.choice,
            order: 1,
            label: lorem.words(2),
            required: false,
            options: [
              { label: lorem.words(2), value: 0 },
              { label: lorem.words(2), value: 1 },
              { label: lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q2',
            type: ItemType.choice,
            order: 2,
            label: lorem.words(2),
            required: false,
            options: [
              { label: lorem.words(2), value: 0 },
              { label: lorem.words(2), value: 1 },
              { label: lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q3',
            type: ItemType.range,
            order: 3,
            label: lorem.words(2),
            required: false,
            range: {
              min: { value: 0, label: lorem.words(3) },
              max: { value: 5, label: lorem.words(3) },
            },
            alertCondition: [{ type: AlertConditionType.equal, value: '5' }],
          },
        ],
        severityLevels: [
          { min: 0, max: 2, label: 'severity low' },
          { min: 3, max: 6, label: 'severity high' },
        ],
        notificationScoreThreshold: 5,
      }),
    );

    who5TypeTemplate = await service.createQuestionnaire(
      generateCreateQuestionnaireParams({
        type: QuestionnaireType.who5,
        items: [
          {
            code: 'q1',
            type: ItemType.choice,
            order: 1,
            label: lorem.words(2),
            required: false,
            options: [
              { label: lorem.words(2), value: 0 },
              { label: lorem.words(2), value: 1 },
              { label: lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q2',
            type: ItemType.choice,
            order: 2,
            label: lorem.words(2),
            required: false,
            options: [
              { label: lorem.words(2), value: 0 },
              { label: lorem.words(2), value: 1 },
              { label: lorem.words(2), value: 2 },
            ],
          },
        ],
        notificationScoreThreshold: 4,
      }),
    );

    npsTypeTemplate = await service.createQuestionnaire(
      generateCreateQuestionnaireParams({
        type: QuestionnaireType.nps,
        items: [
          {
            code: 'q1',
            type: ItemType.range,
            order: 0,
            label: lorem.words(2),
            required: true,
            range: {
              min: {
                value: 0,
                label: 'not likely',
              },
              max: {
                value: 10,
                label: 'very likely',
              },
            },
          },
        ],
        severityLevels: [
          { min: 0, max: 6, label: 'Detractor' },
          { min: 7, max: 8, label: 'Passive' },
          { min: 9, max: 10, label: 'Promoter' },
        ],
      }),
    );

    lhpTypeTemplate = await service.createQuestionnaire(buildLHPQuestionnaire());
    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  afterEach(() => {
    spyOnEventEmitter.mockReset();
  });

  describe('createQuestionnaire', () => {
    it('should create a questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      const { id } = await service.createQuestionnaire({ ...params });
      expect(id).not.toBeUndefined();

      const createdQuestionnaire = await questionnaireModel.findById(id).lean();
      expect(createdQuestionnaire).toEqual({
        ...params,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('getActiveQuestionnaires', () => {
    it('should get a single active questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      // create 2 questionnaires with the same type (only one - latest - is active)
      await service.createQuestionnaire(params);

      // perform an update to questionnaire name..
      const updatedQuestionnaireName = lorem.words(3);
      const { id } = await service.createQuestionnaire({
        ...params,
        name: updatedQuestionnaireName,
      });

      const allQuestionnaires = await service.getActiveQuestionnaires();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(allQuestionnaires.find((item) => item.id === id).toObject()).toEqual({
        ...params,
        name: updatedQuestionnaireName,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('getQuestionnaireById', () => {
    it('should get a single questionnaire by id', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      const questionnaire = await service.createQuestionnaire(params);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect((await service.getQuestionnaireById(questionnaire.id)).toObject()).toEqual({
        ...params,
        _id: new Types.ObjectId(questionnaire.id),
        active: true,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        createdAt: questionnaire.createdAt,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        updatedAt: questionnaire.updatedAt,
      });
    });

    it('should fail to get non existing questionnaire', async () => {
      await expect(service.getQuestionnaireById(generateId())).rejects.toThrow(
        Errors.get(ErrorType.questionnaireNotFound),
      );
    });
  });

  describe('submitQuestionnaireResponse', () => {
    it.each([
      [
        'should submit a questionnaire response and issue an alert - with score label',
        [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '2' }, // does not satisfy alert condition
        ],
        '6',
      ],
      [
        'should submit a questionnaire response and issue an alert - with alert label',
        [
          { code: 'q1', value: '1' },
          { code: 'q2', value: '1' },
          { code: 'q3', value: '5' }, // satisfy alert condition
        ],
        'Nearly Every Day',
      ],
    ])(`%s`, async (_, answers, expectedScore) => {
      const memberId = generateId();

      const { id } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        memberId,
        answers,
      });

      const qr = await questionnaireResponseModel.findById(id).lean();

      expect(qr).toEqual({
        _id: id,
        questionnaireId: new Types.ObjectId(phq9TypeTemplate.id.toString()),
        deleted: false,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        memberId: new Types.ObjectId(memberId),
        answers,
      });

      expect(spyOnEventEmitter).toHaveBeenCalledWith(EventType.onAlertForQRSubmit, {
        memberId,
        questionnaireName: phq9TypeTemplate.shortName,
        score: expectedScore,
        questionnaireType: phq9TypeTemplate.type,
        questionnaireResponseId: id.toString(),
      });
    });

    it('should fail to submit a questionnaire response - invalid questionnaire id', async () => {
      const memberId = generateId();

      await expect(
        service.submitQuestionnaireResponse({
          questionnaireId: generateId(),
          memberId,
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '2' },
            { code: 'q3', value: '1' },
          ],
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.questionnaireNotFound)));
    });

    it('should fail to submit a questionnaire response - invalid response', async () => {
      const memberId = generateId();

      await expect(
        service.submitQuestionnaireResponse({
          questionnaireId: phq9TypeTemplate.id,
          memberId,
          answers: [
            { code: 'q1', value: '6' },
            { code: 'q2', value: '2' },
          ],
        }),
      ).rejects.toThrowError(
        `${Errors.get(
          ErrorType.questionnaireResponseInvalidResponse,
        )}: answer for 'choice' type question with invalid value code: 'q1', value: '6'`,
      );
    });
  });

  describe('getQuestionnaireResponseById', () => {
    it('should get questionnaire response by id', async () => {
      const memberId = generateId();

      const { id } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });

      const qr = await service.getQuestionnaireResponseById(id);

      expect(qr).toEqual({
        id: qr.id,
        questionnaireId: new Types.ObjectId(phq9TypeTemplate.id.toString()),
        type: QuestionnaireType.phq9,
        deleted: false,
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        memberId: new Types.ObjectId(memberId),
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
        result: { alert: false, score: 5, severity: 'severity high' },
      });
    });
  });

  describe('getQuestionnaireResponseByMemberId', () => {
    it('should get questionnaire responses by member id', async () => {
      const memberId = generateId();

      const { id: id1 } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });

      const { id: id2 } = await service.submitQuestionnaireResponse({
        questionnaireId: who5TypeTemplate.id.toString(),
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '1' },
        ],
      });

      const { id: id3 } = await service.submitQuestionnaireResponse({
        questionnaireId: npsTypeTemplate.id.toString(),
        memberId,
        answers: [{ code: 'q1', value: '2' }],
      });

      const qrs = await service.getQuestionnaireResponseByMemberId(memberId);

      expect(qrs).toEqual([
        {
          id: id1,
          questionnaireId: new Types.ObjectId(phq9TypeTemplate.id.toString()),
          deleted: false,
          type: QuestionnaireType.phq9,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          memberId: new Types.ObjectId(memberId),
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '2' },
            { code: 'q3', value: '1' },
          ],
          result: { alert: false, score: 5, severity: 'severity high' },
        },
        {
          id: id2,
          questionnaireId: new Types.ObjectId(who5TypeTemplate.id.toString()),
          deleted: false,
          type: QuestionnaireType.who5,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          memberId: new Types.ObjectId(memberId),
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '1' },
          ],
          result: { alert: false, score: undefined, severity: undefined },
        },
        {
          id: id3,
          questionnaireId: new Types.ObjectId(npsTypeTemplate.id.toString()),
          deleted: false,
          type: QuestionnaireType.nps,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          memberId: new Types.ObjectId(memberId),
          answers: [{ code: 'q1', value: '2' }],
          result: { alert: false, score: 2, severity: 'Detractor' },
        },
      ]);
    });
  });

  describe('deleteMemberQuestionnaireResponses', () => {
    test.each([true, false])('should %p delete member questionnaire responses', async (hard) => {
      const memberId = generateId();

      await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });

      await service.submitQuestionnaireResponse({
        questionnaireId: who5TypeTemplate.id.toString(),
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '1' },
        ],
      });

      let qrs = await service.getQuestionnaireResponseByMemberId(memberId);

      expect(qrs).toHaveLength(2);

      await service.deleteMemberQuestionnaireResponses({ memberId, deletedBy: memberId, hard });

      qrs = await service.getQuestionnaireResponseByMemberId(memberId);

      expect(qrs).toHaveLength(0);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const deletedQRs = await questionnaireResponseModel.findWithDeleted({
        memberId: new Types.ObjectId(memberId),
      });
      if (hard) {
        expect(deletedQRs).toHaveLength(0);
      } else {
        checkDelete(deletedQRs, { memberId: new Types.ObjectId(memberId) }, memberId);
      }
    });
  });

  describe('findItemByCode', () => {
    it.each([
      [
        'should find item by code',
        [{ code: 'q1', type: ItemType.choice }],
        'q1',
        { code: 'q1', type: ItemType.choice },
      ],
      ['should not find item by code', [{ code: 'q1', type: ItemType.choice }], 'q2', undefined],
      [
        'should find internal (recursive) item by code',
        [
          {
            code: 'g1',
            type: ItemType.group,
            items: [
              {
                code: 'g1.1',
                type: ItemType.group,
                items: [{ code: 'q1', type: ItemType.choice }],
              },
            ],
          },
        ],
        'q1',
        { code: 'q1', type: ItemType.choice },
      ],
    ])(`%s`, async (_, items, code, expectedItem) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(service.findItemByCode(items, code)).toEqual(expectedItem);
    });
  });

  describe('validate', () => {
    it.each([
      [
        'invalid answer - code not in questionnaire',
        [{ code: 'q1', value: '2' }],
        mockGenerateQuestionnaire({ items: [] }),
        'answer with invalid code q1 - not in questionnaire',
      ],
      [
        'invalid type choice answer - not in option list',
        [{ code: 'q1', value: '5' }],
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              options: [
                { label: lorem.words(3), value: 3 },
                { label: lorem.words(3), value: 4 },
              ],
            }),
          ],
        }),
        `answer for 'choice' type question with invalid value code: 'q1', value: '5`,
      ],
      [
        'invalid type range answer - not in range',
        [{ code: 'q1', value: '5' }],
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.range,
              code: 'q1',
              range: {
                min: { value: 0, label: lorem.words(3) },
                max: { value: 4, label: lorem.words(3) },
              },
            }),
          ],
        }),
        `answer for 'range' type question with value out of range: 'q1', value: '5'`,
      ],
    ])(`%s`, async (_, answers, template, error) => {
      if (error) {
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          service.validate(answers, template);
        }).toThrow(error);
      } else {
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          service.validate(answers, template);
        }).not.toThrow();
      }
    });

    it.each([
      [{ answers: [{ code: 'q1', value: '1' }], errors: 'q2' }],
      [{ answers: [], errors: 'q1,q2' }],
    ])(
      'should fail to submit a questionnaire response - missing required question %s',
      async (params) => {
        await expect(
          service.submitQuestionnaireResponse({
            questionnaireId: lhpTypeTemplate.id,
            memberId: generateId(),
            answers: params.answers,
          }),
        ).rejects.toThrowError(
          `${Errors.get(
            ErrorType.questionnaireResponseInvalidResponse,
          )}: missing required answer codes: ${params.errors}`,
        );
      },
    );

    it('should allow submit of an empty QR for GAD-7 - no required fields', async () => {
      const { id } = await service.createQuestionnaire(buildGAD7Questionnaire());

      await expect(
        service.submitQuestionnaireResponse({
          questionnaireId: id,
          memberId: generateId(),
          answers: [],
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('isAlertConditionsSatisfied', () => {
    it.each([
      [
        'empty item list - does not satisfy alert condition',
        { code: 'q1', value: '2' },
        mockGenerateQuestionnaire({ items: [] }),
        false,
      ],
      [
        'condition type `equal` - satisfy',
        { code: 'q1', value: '5' },
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              alertCondition: [
                { type: AlertConditionType.equal, value: '5' },
                { type: AlertConditionType.lte, value: '3' },
              ],
            }),
          ],
        }),
        true,
      ],
      [
        'condition type `equal` - not satisfy',
        { code: 'q1', value: '6' },
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              alertCondition: [
                { type: AlertConditionType.equal, value: '5' },
                { type: AlertConditionType.lte, value: '3' },
              ],
            }),
          ],
        }),
        false,
      ],
      [
        'condition type `lte` - satisfy',
        { code: 'q1', value: '3' },
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              alertCondition: [
                { type: AlertConditionType.equal, value: '5' },
                { type: AlertConditionType.lte, value: '3' },
              ],
            }),
          ],
        }),
        true,
      ],
      [
        'condition type `gte` - satisfy',
        { code: 'q1', value: '3' },
        mockGenerateQuestionnaire({
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              alertCondition: [
                { type: AlertConditionType.equal, value: '5' },
                { type: AlertConditionType.gte, value: '2' },
              ],
            }),
          ],
        }),
        true,
      ],
    ])(`%s`, async (_, answer, template, satisfies) => {
      expect(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        service.isAlertConditionsSatisfied(answer, template),
      ).toEqual(satisfies);
    });
  });

  describe('getLatestQuestionnaireResponse', () => {
    let submitQuestionnaireResponse;
    const options = new PersonasOptions();

    beforeAll(async () => {
      submitQuestionnaireResponse = {
        questionnaireId: lhpTypeTemplate.id.toString(),
        memberId: generateObjectId(),
        answers: [
          { code: 'q1', value: '3' },
          { code: 'q2', value: '1' },
        ],
      };

      await service.submitQuestionnaireResponse(submitQuestionnaireResponse);
    });

    it('should return undefined for a non existing member', async () => {
      const result = await service.getHealthPersona({ memberId: generateId() });
      expect(result).toBeUndefined();
    });

    // eslint-disable-next-line max-len
    it(`should return undefined for a non existing ${QuestionnaireType.lhp} questionnaire`, async () => {
      const submitResponse = {
        questionnaireId: npsTypeTemplate.id.toString(),
        memberId: generateId(),
        answers: [{ code: 'q1', value: '2' }],
      };
      await service.submitQuestionnaireResponse(submitResponse);

      const result = await service.getHealthPersona({ memberId: submitResponse.memberId });
      expect(result).toBeUndefined();
    });

    it(`should get the latest ${QuestionnaireType.lhp} questionnaire response`, async () => {
      const duplicatedQuestionnaireResponse = { ...submitQuestionnaireResponse };
      duplicatedQuestionnaireResponse.answers = [
        { code: 'q1', value: '2' },
        { code: 'q2', value: '4' },
      ];
      await service.submitQuestionnaireResponse(duplicatedQuestionnaireResponse);

      const healthPersona = await service.getHealthPersona({
        memberId: submitQuestionnaireResponse.memberId,
      });

      expect(healthPersona).toEqual(HealthPersona.highEffort);
    });

    const params = Object.values(HealthPersona).flatMap((healthPersona: HealthPersona) => {
      const personas = options.get().get(healthPersona);
      return personas.q1.flatMap((q1Item) =>
        personas.q2.map((q2Item) => ({
          healthPersona,
          answers: [
            { code: 'q1', value: q1Item },
            { code: 'q2', value: q2Item },
          ],
        })),
      );
    });

    test.each(params)(
      'should return %p health persona on specific response',
      async ({ healthPersona, answers }) => {
        const submitResponse = {
          questionnaireId: lhpTypeTemplate.id.toString(),
          memberId: generateId(),
          answers,
        };
        await service.submitQuestionnaireResponse(submitResponse);

        const result = await service.getHealthPersona({ memberId: submitResponse.memberId });
        expect(result).toEqual(healthPersona);
      },
    );
  });
});
