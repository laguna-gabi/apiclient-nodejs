import { BEFORE_ALL_TIMEOUT, generateCreateOrSetActionItemParams } from '..';
import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux';

const stringError = `String cannot represent a non string value`;

describe('Validations - actionItem', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createOrSetActionItem', () => {
    /* eslint-disable max-len */
    test.each`
      input                        | error
      ${{ id: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ memberId: 123 }}         | ${{ missingFieldError: stringError }}
      ${{ title: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ description: 123 }}      | ${{ missingFieldError: stringError }}
      ${{ rejectNote: 123 }}       | ${{ missingFieldError: stringError }}
      ${{ relatedEntities: 123 }}  | ${{ missingFieldError: 'Expected type "RelatedEntityInput" to be an object' }}
      ${{ link: 123 }}             | ${{ missingFieldError: 'Expected type "ActionItemLinkInput" to be an object' }}
      ${{ status: 123 }}           | ${{ missingFieldError: `Enum \"ActionItemStatus\" cannot represent non-string value` }}
      ${{ priority: 123 }}         | ${{ missingFieldError: `Enum \"ActionItemPriority\" cannot represent non-string value` }}
      ${{ category: 123 }}         | ${{ missingFieldError: `Enum \"ActionItemCategory\" cannot represent non-string value` }}
      ${{ deadline: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.journeyActionItemDeadline)] }}
    `(`should fail to update actionItem since $input is not a valid type`, async (params) => {
      /* eslint-enable max-len */
      const createOrSetActionItemParams = generateCreateOrSetActionItemParams({
        ...params.input,
      });
      await handler.mutations.createOrSetActionItem({
        createOrSetActionItemParams,
        ...params.error,
      });
    });
  });
});
