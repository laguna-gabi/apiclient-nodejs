/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable max-len */
import { mockLogger, mockProcessWarnings } from '@lagunahealth/pandora';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types, model } from 'mongoose';
import {
  dbConnect,
  dbDisconnect,
  defaultModules,
  generateCreateQuestionnaireParams,
  generateId,
  mockGenerateQuestionnaire,
  mockGenerateQuestionnaireItem,
} from '../../test';
import {
  AlertConditionType,
  CreateQuestionnaireParams,
  Questionnaire,
  QuestionnaireDto,
  QuestionnaireModule,
  QuestionnaireResponse,
  QuestionnaireResponseDto,
  QuestionnaireService,
  QuestionnaireType,
} from '../../src/questionnaire';
import * as faker from 'faker';
import { ErrorType, Errors, ItemType, LoggerService } from '../../src/common';

describe('QuestionnaireService', () => {
  let module: TestingModule;
  let service: QuestionnaireService;
  let questionnaireModel: Model<typeof QuestionnaireDto>;
  let questionnaireResponseModel: Model<typeof QuestionnaireResponseDto>;
  let phq9TypeTemplate: Questionnaire;
  let who5TypeTemplate: Questionnaire;

  beforeAll(async () => {
    mockProcessWarnings(); // to hide pino prettyPrint warning
    module = await Test.createTestingModule({
      imports: defaultModules().concat(QuestionnaireModule),
    }).compile();

    service = module.get<QuestionnaireService>(QuestionnaireService);

    questionnaireModel = model(Questionnaire.name, QuestionnaireDto);
    questionnaireResponseModel = model(QuestionnaireResponse.name, QuestionnaireResponseDto);
    mockLogger(module.get<LoggerService>(LoggerService));

    phq9TypeTemplate = await service.createQuestionnaire(
      generateCreateQuestionnaireParams({
        type: QuestionnaireType.phq9,
        items: [
          {
            code: 'q1',
            type: ItemType.choice,
            order: 1,
            label: faker.lorem.words(2),
            required: false,
            options: [
              { label: faker.lorem.words(2), value: 0 },
              { label: faker.lorem.words(2), value: 1 },
              { label: faker.lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q2',
            type: ItemType.choice,
            order: 1,
            label: faker.lorem.words(2),
            required: false,
            options: [
              { label: faker.lorem.words(2), value: 0 },
              { label: faker.lorem.words(2), value: 1 },
              { label: faker.lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q3',
            type: ItemType.range,
            order: 1,
            label: faker.lorem.words(2),
            required: false,
            range: {
              min: { value: 0, label: faker.lorem.words(3) },
              max: { value: 5, label: faker.lorem.words(3) },
            },
          },
        ],
        severityLevels: [
          { min: 0, max: 2, label: 'severity low' },
          { min: 3, max: 6, label: 'severity high' },
        ],
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
            label: faker.lorem.words(2),
            required: false,
            options: [
              { label: faker.lorem.words(2), value: 0 },
              { label: faker.lorem.words(2), value: 1 },
              { label: faker.lorem.words(2), value: 2 },
            ],
          },
          {
            code: 'q2',
            type: ItemType.choice,
            order: 1,
            label: faker.lorem.words(2),
            required: false,
            options: [
              { label: faker.lorem.words(2), value: 0 },
              { label: faker.lorem.words(2), value: 1 },
              { label: faker.lorem.words(2), value: 2 },
            ],
          },
        ],
      }),
    );

    await dbConnect();
  });

  afterAll(async () => {
    await module.close();
    await dbDisconnect();
  });

  describe('createQuestionnaire', () => {
    it('should create a questionnaire', async () => {
      const createdBy = generateId();

      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      const { id } = await service.createQuestionnaire({ ...params, createdBy });
      expect(id).not.toBeUndefined();

      const createdQuestionnaire = await questionnaireModel.findById(id).lean();
      expect(createdQuestionnaire).toEqual({
        ...params,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        createdBy: new Types.ObjectId(createdBy),
      });
    });
  });

  describe('getActiveQuestionnaires', () => {
    it('should get a single active questionnaire', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      // create 2 questionnaires with the same type (only one - latest - is active)
      await service.createQuestionnaire(params);

      // perform an update to questionnaire name..
      const updatedQuestionnaireName = faker.lorem.words(3);
      const { id } = await service.createQuestionnaire({
        ...params,
        name: updatedQuestionnaireName,
      });

      const allQuestionnaires = await service.getActiveQuestionnaires();

      // @ts-ignore
      expect(allQuestionnaires.find((item) => item.id === id).toObject()).toEqual({
        ...params,
        name: updatedQuestionnaireName,
        _id: new Types.ObjectId(id),
        active: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        createdBy: params.createdBy,
      });
    });
  });

  describe('getQuestionnaireById', () => {
    it('should get a single questionnaire by id', async () => {
      const params: CreateQuestionnaireParams = generateCreateQuestionnaireParams();

      const questionnaire = await service.createQuestionnaire(params);

      // @ts-ignore
      expect((await service.getQuestionnaireById(questionnaire.id)).toObject()).toEqual({
        ...params,
        _id: new Types.ObjectId(questionnaire.id),
        active: true,
        // @ts-ignore
        createdAt: questionnaire.createdAt,
        // @ts-ignore
        updatedAt: questionnaire.updatedAt,
      });
    });
  });

  describe('submitQuestionnaireResponse', () => {
    it('should submit a questionnaire response', async () => {
      const createdBy = generateId();
      const memberId = generateId();

      const { id } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        createdBy,
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });

      const qr = await questionnaireResponseModel.findById(id).lean();

      expect(qr).toEqual({
        _id: id,
        questionnaireId: new Types.ObjectId(phq9TypeTemplate.id.toString()),
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        createdBy: new Types.ObjectId(createdBy),
        memberId: new Types.ObjectId(memberId),
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });
    });

    it('should fail to submit a questionnaire response - invalid questionnaire id', async () => {
      const createdBy = generateId();
      const memberId = generateId();

      await expect(
        service.submitQuestionnaireResponse({
          questionnaireId: generateId(),
          createdBy,
          memberId,
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '2' },
            { code: 'q3', value: '1' },
          ],
        }),
      ).rejects.toThrow(
        Error(Errors.get(ErrorType.questionnaireResponseInvalidQuestionnaireIdNotFound)),
      );
    });

    it('should fail to submit a questionnaire response - invalid response', async () => {
      const createdBy = generateId();
      const memberId = generateId();

      await expect(
        service.submitQuestionnaireResponse({
          questionnaireId: phq9TypeTemplate.id,
          createdBy,
          memberId,
          answers: [
            { code: 'q1', value: '6' },
            { code: 'q2', value: '2' },
          ],
        }),
      ).rejects.toThrow(Error(Errors.get(ErrorType.questionnaireResponseInvalidResponse)));
    });
  });

  describe('getQuestionnaireResponseById', () => {
    it('should get questionnaire response by id', async () => {
      const createdBy = generateId();
      const memberId = generateId();

      const { id } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        createdBy,
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
        updatedAt: expect.any(Date),
        createdAt: expect.any(Date),
        createdBy: new Types.ObjectId(createdBy),
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
      const createdBy = generateId();
      const memberId = generateId();

      const { id: id1 } = await service.submitQuestionnaireResponse({
        questionnaireId: phq9TypeTemplate.id.toString(),
        createdBy,
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '2' },
          { code: 'q3', value: '1' },
        ],
      });

      const { id: id2 } = await service.submitQuestionnaireResponse({
        questionnaireId: who5TypeTemplate.id.toString(),
        createdBy,
        memberId,
        answers: [
          { code: 'q1', value: '2' },
          { code: 'q2', value: '1' },
        ],
      });

      const qrs = await service.getQuestionnaireResponseByMemberId(memberId);

      expect(qrs).toEqual([
        {
          id: id1,
          questionnaireId: new Types.ObjectId(phq9TypeTemplate.id.toString()),
          type: QuestionnaireType.phq9,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          createdBy: new Types.ObjectId(createdBy),
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
          type: QuestionnaireType.who5,
          updatedAt: expect.any(Date),
          createdAt: expect.any(Date),
          createdBy: new Types.ObjectId(createdBy),
          memberId: new Types.ObjectId(memberId),
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '1' },
          ],
          result: { alert: false, score: undefined, severity: undefined },
        },
      ]);
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
        'invalid answer - code not in template',
        [{ code: 'q1', value: '2' }],
        mockGenerateQuestionnaire({ items: [] }),
        'answer with invalid code q1 - not in template',
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
                { label: faker.lorem.words(3), value: 3 },
                { label: faker.lorem.words(3), value: 4 },
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
                min: { value: 0, label: faker.lorem.words(3) },
                max: { value: 4, label: faker.lorem.words(3) },
              },
            }),
          ],
        }),
        `answer for 'range' type question with value out of range: 'q1', value: '5'`,
      ],
    ])(`%s`, async (_, answers, template, error) => {
      if (error) {
        expect(() => {
          // @ts-ignore
          service.validate(answers, template);
        }).toThrow(error);
      } else {
        expect(() => {
          // @ts-ignore
          service.validate(answers, template);
        }).not.toThrow();
      }
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
        // @ts-ignore
        service.isAlertConditionsSatisfied(answer, template),
      ).toEqual(satisfies);
    });
  });
});
