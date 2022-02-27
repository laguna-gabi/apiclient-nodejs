import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux';
import {
  generateCarePlanTypeInput,
  generateCreateCarePlanParams,
  generateCreateRedFlagParams,
  generateId,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
} from '../generators';
import {
  CreateCarePlanParams,
  CreateRedFlagParams,
  UpdateBarrierParams,
  UpdateCarePlanParams,
} from '../../src/care';

const stringError = `String cannot represent a non string value`;

describe('Validations - care (barriers & care plans & red flags)', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createRedFlag', () => {
    /* eslint-disable max-len */
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'type'}     | ${`Field "type" of required type "RedFlagType!" was not provided.`}
    `(
      `should fail to create a red flag since mandatory field $field is missing`,
      async (params) => {
        const createRedFlagParams: CreateRedFlagParams = generateCreateRedFlagParams();
        delete createRedFlagParams[params.field];
        await handler.mutations.createRedFlag({
          createRedFlagParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input                    | error
      ${{ memberId: 123 }}     | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ type: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "RedFlagType" enum.' }}
    `(`should fail to create a red flag since $input is not a valid`, async (params) => {
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
    `(`should fail to getMemberRedFlags since $input is not valid,`, async (params) => {
      await handler.queries.getMemberRedFlags({
        ...params.input,
        ...params.error,
      });
    });
  });

  describe('updateBarrier', () => {
    /* eslint-disable max-len */
    test.each`
      field   | error
      ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
    `(`should fail to update a barrier since mandatory field $field is missing`, async (params) => {
      const updateBarrierParams: UpdateBarrierParams = generateUpdateBarrierParams();
      delete updateBarrierParams[params.field];
      await handler.mutations.updateBarrier({
        updateBarrierParams: updateBarrierParams,
        missingFieldError: params.error,
      });
    });

    /* eslint-disable max-len */
    test.each`
      input                      | error
      ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ type: 123 }}           | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}          | ${{ missingFieldError: stringError }}
      ${{ status: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "CareStatus" enum.' }}
    `(`should fail to update a barrier since $input is not valid`, async (params) => {
      const updateBarrierParams: UpdateBarrierParams = generateUpdateBarrierParams({
        id: generateId(),
        ...params.input,
      });
      await handler.mutations.updateBarrier({ updateBarrierParams, ...params.error });
    });
  });

  describe('getMemberBarriers', () => {
    test.each`
      input                | error
      ${{ memberId: 123 }} | ${{ invalidFieldsError: stringError }}
    `(`should fail to getMemberBarriers since $field is not valid,`, async (params) => {
      await handler.queries.getMemberBarriers({
        ...params.input,
        ...params.error,
      });
    });
  });

  describe('createCarePlan', () => {
    /* eslint-disable max-len */
    test.each`
      field          | error
      ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'type'}      | ${`Field "type" of required type "CarePlanTypeInput!" was not provided.`}
      ${'barrierId'} | ${`Field "barrierId" of required type "String!" was not provided.`}
    `(
      `should fail to create a care plan since mandatory field $field is missing`,
      async (params) => {
        const createCarePlanParams: CreateCarePlanParams = generateCreateCarePlanParams({
          type: generateCarePlanTypeInput({ id: generateId() }),
          barrierId: generateId(),
        });
        delete createCarePlanParams[params.field];
        await handler.mutations.createCarePlan({
          createCarePlanParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input                                 | error
      ${{ barrierId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}                     | ${{ missingFieldError: stringError }}
      ${{ dueDate: 'not-valid' }}           | ${{ missingFieldError: 'must be a Date instance' }}
      ${{ type: 'not-valid' }}              | ${{ missingFieldError: 'Expected type "CarePlanTypeInput" to be an object' }}
      ${{ type: { id: 123 } }}              | ${{ missingFieldError: stringError }}
      ${{ type: { custom: 123 } }}          | ${{ missingFieldError: stringError }}
      ${{ type: { custom: 'a', id: 'b' } }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.carePlanTypeInputInvalid)] }}
      ${{ type: {} }}                       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.carePlanTypeInputInvalid)] }}
    `(`should fail to create a care plan since $input is not valid`, async (params) => {
      const createCarePlanParams: CreateCarePlanParams = generateCreateCarePlanParams({
        type: generateCarePlanTypeInput({ id: generateId() }),
        barrierId: generateId(),
        ...params.input,
      });
      delete createCarePlanParams.createdBy;

      await handler.mutations.createCarePlan({ createCarePlanParams, ...params.error });
    });
  });

  describe('updateCarePlan', () => {
    /* eslint-disable max-len */
    test.each`
      field   | error
      ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
    `(
      `should fail to update a care plan since mandatory field $field is missing`,
      async (params) => {
        const updateCarePlanParams: UpdateCarePlanParams = generateUpdateCarePlanParams();
        delete updateCarePlanParams[params.field];
        await handler.mutations.updateCarePlan({
          updateCarePlanParams: updateCarePlanParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input                      | error
      ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}          | ${{ missingFieldError: stringError }}
      ${{ status: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "CareStatus" enum.' }}
    `(`should fail to update a care plan since $input is not valid`, async (params) => {
      const updateCarePlanParams: UpdateCarePlanParams = generateUpdateCarePlanParams({
        id: generateId(),
        ...params.input,
      });
      await handler.mutations.updateCarePlan({ updateCarePlanParams, ...params.error });
    });
  });

  describe('getMemberCarePlans', () => {
    test.each`
      input                | error
      ${{ memberId: 123 }} | ${{ invalidFieldsError: stringError }}
    `(`should fail to getMemberCarePlans since $field is not valid,`, async (params) => {
      await handler.queries.getMemberCarePlans({
        ...params.input,
        ...params.error,
      });
    });
  });
});
