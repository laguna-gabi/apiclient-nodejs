import { CreateQuestionnaireParams } from '../../src/questionnaire';
import { ErrorType, Errors, ItemType, UserRole } from '../../src/common';
import { Handler } from '../aux/handler';
import { generateCreateQuestionnaireParams, mockGenerateQuestionnaireItem } from '../generators';
import { generateCreateUserParams } from '../index';

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

  describe('createQuestionnaire', () => {
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
  });
});
