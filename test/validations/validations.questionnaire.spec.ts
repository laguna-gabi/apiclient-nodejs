/* eslint-disable max-len */
import {
  CreateQuestionnaireParams,
  SubmitQuestionnaireResponseParams,
} from '../../src/questionnaire';
import { ErrorType, Errors, ItemType, UserRole } from '../../src/common';
import { Handler } from '../aux/handler';
import {
  generateCreateQuestionnaireParams,
  generateId,
  generateSubmitQuestionnaireResponseParams,
  mockGenerateQuestionnaireItem,
} from '../generators';
import { generateCreateUserParams } from '../index';

const stringError = `String cannot represent a non string value`;

describe('Validations - questionnaire', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
    const { id } = await handler.mutations.createUser({ userParams: generateCreateUserParams() });
    handler.setContextUserId(id, '', [UserRole.admin]);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('getQuestionnaire', () => {
    it('should fail to get questionnaire - invalid id', async () => {
      await handler.queries.getQuestionnaire({ id: 123, invalidFieldsError: stringError });
    });
  });

  describe('getMemberQuestionnaireResponses', () => {
    it('should fail to get questionnaire response for member - invalid member id', async () => {
      await handler.queries.getMemberQuestionnaireResponses({
        memberId: 123,
        invalidFieldsError: stringError,
      });
    });
  });

  describe('getQuestionnaireResponse', () => {
    it('should fail to get questionnaire response - invalid id', async () => {
      await handler.queries.getQuestionnaireResponse({
        id: 123,
        invalidFieldsError: stringError,
      });
    });
  });

  describe('createQuestionnaire', () => {
    test.each`
      field      | error
      ${'name'}  | ${`Field "name" of required type "String!" was not provided.`}
      ${'type'}  | ${`Field "type" of required type "QuestionnaireType!" was not provided.`}
      ${'items'} | ${`Field "items" of required type "[ItemInput!]!" was not provided.`}
    `(
      `should fail to endAndCreate a todo since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const createQuestionnaireParams: CreateQuestionnaireParams =
          generateCreateQuestionnaireParams();
        delete createQuestionnaireParams[params.field];

        await handler.mutations.createQuestionnaire({
          createQuestionnaireParams,
          missingFieldError: params.error,
        });
      },
    );

    it(`should fail to create a questionnaire due to duplicate item codes`, async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [
            { ...mockGenerateQuestionnaireItem(), code: 'Q1' },
            { ...mockGenerateQuestionnaireItem(), code: 'Q1' },
          ],
        });

      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireItemsDuplicateCode)],
      });
    });

    // eslint-disable-next-line max-len
    it(`should fail to create a questionnaire due to duplicate item codes (inside internal groups)`, async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [
            { ...mockGenerateQuestionnaireItem(), code: 'Q1' },
            {
              ...mockGenerateQuestionnaireItem(),
              code: 'G1',
              type: ItemType.group,
              items: [{ ...mockGenerateQuestionnaireItem(), code: 'Q1' }],
            },
          ],
        });

      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireItemsDuplicateCode)],
      });
    });

    // eslint-disable-next-line max-len
    it('should fail to create a questionnaire due to missing option list in a `choice` type item', async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [
            { ...mockGenerateQuestionnaireItem(), type: ItemType.choice, options: undefined },
          ],
        });

      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireItemMissingOptionsCode)],
      });
    });

    // eslint-disable-next-line max-len
    it('should fail to create a questionnaire due to missing range in a `range` type item', async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [{ ...mockGenerateQuestionnaireItem(), type: ItemType.range, range: undefined }],
        });

      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireItemMissingRangeCode)],
      });
    });

    it('should fail to create a questionnaire due to invalid severity level list', async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [
            {
              ...mockGenerateQuestionnaireItem(),
            },
          ],
          severityLevels: [
            { min: 0, max: 4, label: 'low level' },
            { min: 4, max: 5, label: 'high level' }, // invalid range (max of N element must equal N+1 element min value + 1)
          ],
        });

      await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireSeverityLevelInvalidCode)],
      });
    });
  });

  describe('submitQuestionnaireResponse', () => {
    /* eslint-disable max-len */
    test.each`
      field                | error
      ${'questionnaireId'} | ${`Field "questionnaireId" of required type "String!" was not provided.`}
      ${'memberId'}        | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'answers'}         | ${`Field "answers" of required type "[AnswerInput!]!" was not provided.`}
    `(
      `should fail to endAndCreate a todo since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams =
          generateSubmitQuestionnaireResponseParams();
        delete submitQuestionnaireResponseParams[params.field];

        await handler.mutations.submitQuestionnaireResponse({
          submitQuestionnaireResponseParams,
          missingFieldError: params.error,
        });
      },
    );

    it(`should fail to submit a response due to invalid member id`, async () => {
      await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          memberId: '123',
        }),
        invalidFieldsErrors: [Errors.get(ErrorType.memberIdInvalid)],
      });
    });

    it(`should fail to submit a response due to invalid questionnaire id`, async () => {
      await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId: '123',
        }),
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireResponseInvalidQuestionnaireId)],
      });
    });

    it(`should fail to submit a response due to invalid questionnaire id`, async () => {
      await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId: generateId(),
        }),
        invalidFieldsErrors: [
          Errors.get(ErrorType.questionnaireResponseInvalidQuestionnaireIdNotFound),
        ],
      });
    });

    it(`should fail to submit a response due to invalid response`, async () => {
      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          items: [],
        });

      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
      });

      await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId,
        }),
        invalidFieldsErrors: [Errors.get(ErrorType.questionnaireResponseInvalidResponse)],
      });
    });
  });
});
