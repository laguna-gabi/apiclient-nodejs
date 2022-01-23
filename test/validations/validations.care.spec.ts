import { UserRole } from '../../src/common';
import { Handler } from '../aux';
import { generateCreateRedFlagParams } from '../generators';
import { generateCreateUserParams } from '../index';
import { CreateRedFlagParams } from '../../src/care';

const stringError = `String cannot represent a non string value`;

describe('Validations - care (barriers & care plans & red flags)', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
    const { id } = await handler.mutations.createUser({ userParams: generateCreateUserParams() });
    handler.setContextUserId(id, '', [UserRole.coach]);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createRedFlag', () => {
    /* eslint-disable max-len */
    test.each`
      field            | error
      ${'memberId'}    | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'redFlagType'} | ${`Field "redFlagType" of required type "RedFlagType!" was not provided.`}
    `(
      `should fail to create a red flag since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const createRedFlagParams: CreateRedFlagParams = generateCreateRedFlagParams();
        // delete createRedFlagParams.createdBy;
        delete createRedFlagParams[params.field];
        await handler.mutations.createRedFlag({
          createRedFlagParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input                           | error
      ${{ memberId: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ redFlagType: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "RedFlagType" enum.' }}
    `(`should fail to create a red flag  since $input is not a valid`, async (params) => {
      const createRedFlagParams: CreateRedFlagParams = generateCreateRedFlagParams({
        ...params.input,
      });
      delete createRedFlagParams.createdBy;

      await handler.mutations.createRedFlag({ createRedFlagParams, ...params.error });
    });
  });

  describe('getMemberRedFlags', () => {
    test.each`
      input                | error
      ${{ memberId: 123 }} | ${{ invalidFieldsError: stringError }}
    `(`should fail to getMemberRedFlags since $field is not valid,`, async (params) => {
      await handler.queries.getMemberRedFlags({
        ...params.input,
        ...params.error,
      });
    });
  });
});
