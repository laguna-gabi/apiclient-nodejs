import { generateId, generateOrgParams } from '../index';
import { Errors, ErrorType } from '../../src/common';
import { CreateOrgParams } from '../../src/org';
import { Handler } from '../aux/handler';

const stringError = `String cannot represent a non string value`;

describe('Validations - org', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field              | error
    ${'name'}          | ${`Field "name" of required type "String!" was not provided.`}
    ${'type'}          | ${`Field "type" of required type "OrgType!" was not provided.`}
    ${'trialDuration'} | ${`Field "trialDuration" of required type "Int!" was not provided.`}
    ${'zipCode'}       | ${`Field "zipCode" of required type "String!" was not provided.`}
  `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
    const orgParams: CreateOrgParams = generateOrgParams();
    delete orgParams[params.field];
    await handler.mutations.createOrg({ orgParams, missingFieldError: params.error });
  });

  /* eslint-disable max-len */
  test.each`
    field              | input                      | errors
    ${'name'}          | ${{ name: 1 }}             | ${stringError}
    ${'type'}          | ${{ type: 'not-valid' }}   | ${'does not exist in "OrgType" enum'}
    ${'trialDuration'} | ${{ trialDuration: 24.8 }} | ${'Int cannot represent non-integer value'}
    ${'zipCode'}       | ${{ zipCode: 1 }}          | ${stringError}
  `(
    /* eslint-enable max-len */
    `should fail to create an org since $field is not valid`,
    async (params) => {
      const orgParams: CreateOrgParams = generateOrgParams(params.input);
      await handler.mutations.createOrg({
        orgParams,
        missingFieldError: params.errors,
      });
    },
  );

  it('should validate that trialDuration should be a positive number', async () => {
    const orgParams: CreateOrgParams = generateOrgParams({ trialDuration: 0 });
    await handler.mutations.createOrg({
      orgParams,
      invalidFieldsErrors: [Errors.get(ErrorType.orgTrialDurationOutOfRange)],
    });
  });

  it('should return null for non existing org', async () => {
    const result = await handler.queries.getOrg({
      id: generateId(),
    });
    expect(result).toBeNull();
  });
});
