import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux';
import {
  generateCarePlanTypeInput,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParams,
  generateCreateCarePlanParamsWizard,
  generateCreateRedFlagParamsWizard,
  generateId,
  generateSubmitCareWizardParams,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateRedFlagParams,
} from '../generators';
import {
  CreateCarePlanParams,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '../../src/care';
import { BEFORE_ALL_TIMEOUT } from '..';

const stringError = `String cannot represent a non string value`;

describe('Validations - care (barriers & care plans & red flags)', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('updateRedFlag', () => {
    /* eslint-disable max-len */
    test.each`
      field   | error
      ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
    `(
      `should fail to update a red flag since mandatory field $field is missing`,
      async (params) => {
        const updateRedFlagParams: UpdateRedFlagParams = generateUpdateRedFlagParams();
        delete updateRedFlagParams[params.field];
        await handler.mutations.updateRedFlag({
          updateRedFlagParams: updateRedFlagParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input             | error
      ${{ id: 123 }}    | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }} | ${{ missingFieldError: stringError }}
    `(`should fail to update a red flag since $input is not valid`, async (params) => {
      const updateRedFlagParams: UpdateRedFlagParams = generateUpdateRedFlagParams({
        id: generateId(),
        ...params.input,
      });
      await handler.mutations.updateRedFlag({ updateRedFlagParams, ...params.error });
    });
  });

  describe('getMemberRedFlags', () => {
    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberIdInvalid)}
      ${123}   | ${stringError}
    `(`should fail to get member red flags by id - value $field is invalid`, async (params) => {
      await handler.queries.getMemberRedFlags({
        memberId: params.field,
        invalidFieldsError: params.error,
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
      input                      | error
      ${{ memberId: 123 }}       | ${{ invalidFieldsError: stringError }}
      ${{ memberId: '123' }}     | ${{ invalidFieldsError: Errors.get(ErrorType.memberIdInvalid) }}
      ${{ memberId: undefined }} | ${{ invalidFieldsError: `Variable \"$memberId\" of required type \"String!\" was not provided.` }}
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
      input                       | error
      ${{ id: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ notes: 123 }}           | ${{ missingFieldError: stringError }}
      ${{ status: 'not-valid' }}  | ${{ missingFieldError: 'does not exist in "CareStatus" enum.' }}
      ${{ dueDate: 'not-valid' }} | ${{ missingFieldError: 'must be a Date instance' }}
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

  describe('submitCareWizard', () => {
    /* eslint-disable max-len */
    test.each`
      level         | field          | error
      ${'submit'}   | ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'submit'}   | ${'redFlag'}   | ${`Field "redFlag" of required type "CreateRedFlagParamsWizard!" was not provided.`}
      ${'redFlag'}  | ${'type'}      | ${`Field "type" of required type "String!" was not provided.`}
      ${'redFlag'}  | ${'barriers'}  | ${`Field "barriers" of required type "[CreateBarrierParamsWizard!]!" was not provided.`}
      ${'barrier'}  | ${'type'}      | ${`Field "type" of required type "String!" was not provided.`}
      ${'barrier'}  | ${'carePlans'} | ${`Field "carePlans" of required type "[BaseCarePlanParams!]!" was not provided.`}
      ${'carePlan'} | ${'type'}      | ${`Field "type" of required type "CarePlanTypeInput!" was not provided.`}
    `(
      `should fail to submit care wizard result since mandatory field $field is missing`,
      async (params) => {
        const carePlan = generateCreateCarePlanParamsWizard();
        const barrier = generateCreateBarrierParamsWizard({ carePlans: [carePlan] });
        const redFlag = generateCreateRedFlagParamsWizard({ barriers: [barrier] });
        const wizardParams = generateSubmitCareWizardParams({ redFlag });

        switch (params.level) {
          case 'submit':
            delete wizardParams[params.field];
            break;
          case 'redFlag':
            delete wizardParams.redFlag[params.field];
            break;
          case 'barrier':
            delete wizardParams.redFlag.barriers[0][params.field];
            break;
          case 'carePlan':
            delete wizardParams.redFlag.barriers[0].carePlans[0][params.field];
            break;
        }
        delete wizardParams[params.field];
        await handler.mutations.submitCareWizard({
          submitCareWizardParams: wizardParams,
          missingFieldError: params.error,
        });
      },
    );
  });

  test.each`
    level         | input                                 | error
    ${'submit'}   | ${{ memberId: 123 }}                  | ${{ missingFieldError: stringError }}
    ${'submit'}   | ${{ redFlag: 'not-valid' }}           | ${{ missingFieldError: 'Expected type "CreateRedFlagParamsWizard" to be an object.' }}
    ${'redFlag'}  | ${{ notes: 123 }}                     | ${{ missingFieldError: stringError }}
    ${'redFlag'}  | ${{ type: 123 }}                      | ${{ missingFieldError: stringError }}
    ${'redFlag'}  | ${{ barriers: 'not-valid' }}          | ${{ missingFieldError: 'Expected type "CreateBarrierParamsWizard" to be an object.' }}
    ${'barrier'}  | ${{ notes: 123 }}                     | ${{ missingFieldError: stringError }}
    ${'barrier'}  | ${{ type: 123 }}                      | ${{ missingFieldError: stringError }}
    ${'barrier'}  | ${{ carePlans: 'not-valid' }}         | ${{ missingFieldError: 'Expected type "BaseCarePlanParams" to be an object.' }}
    ${'carePlan'} | ${{ notes: 123 }}                     | ${{ missingFieldError: stringError }}
    ${'carePlan'} | ${{ dueDate: 'not-valid' }}           | ${{ missingFieldError: 'must be a Date instance' }}
    ${'carePlan'} | ${{ type: 'not-valid' }}              | ${{ missingFieldError: 'Expected type "CarePlanTypeInput" to be an object' }}
    ${'carePlan'} | ${{ type: { id: 123 } }}              | ${{ missingFieldError: stringError }}
    ${'carePlan'} | ${{ type: { custom: 123 } }}          | ${{ missingFieldError: stringError }}
    ${'carePlan'} | ${{ type: { custom: 'a', id: 'b' } }} | ${{ missingFieldError: Errors.get(ErrorType.carePlanTypeInputInvalid) }}
    ${'carePlan'} | ${{ type: {} }}                       | ${{ missingFieldError: Errors.get(ErrorType.carePlanTypeInputInvalid) }}
  `(`should fail to submit care wizard result since field $input is not valid`, async (params) => {
    let extra;
    extra = params.level === 'carePlan' ? params.input : {};
    const carePlan = generateCreateCarePlanParamsWizard({ ...extra });
    extra = params.level === 'barrier' ? params.input : {};
    const barrier = generateCreateBarrierParamsWizard({ carePlans: [carePlan], ...extra });
    extra = params.level === 'redFlag' ? params.input : {};
    const redFlag = generateCreateRedFlagParamsWizard({ barriers: [barrier], ...extra });
    extra = params.level === 'submit' ? params.input : {};
    const wizardParams = generateSubmitCareWizardParams({ redFlag, ...extra });

    await handler.mutations.submitCareWizard({
      submitCareWizardParams: wizardParams,
      ...params.error,
    });
  });
});
