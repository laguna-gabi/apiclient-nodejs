import {
  BEFORE_ALL_TIMEOUT,
  generateCreateMobileVersionParams,
  generateUpdateFaultyMobileVersionsParams,
  generateUpdateMinMobileVersionParams,
} from '..';
import {
  CreateMobileVersionParams,
  UpdateFaultyMobileVersionsParams,
  UpdateMinMobileVersionParams,
} from '../../src/configuration';
import { Handler } from '../aux';

const stringError = `String cannot represent a non string value`;

describe('Validations - Configuration', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('MobileVersion', () => {
    test.each`
      field         | error
      ${'version'}  | ${`Field "version" of required type "String!" was not provided.`}
      ${'platform'} | ${`Field "platform" of required type "Platform!" was not provided.`}
    `(
      `should fail to create mobileVersion since mandatory field $field is missing`,
      async (params) => {
        const createMobileVersionParams: CreateMobileVersionParams =
          generateCreateMobileVersionParams();
        delete createMobileVersionParams[params.field];
        await handler.mutations.createMobileVersion({
          createMobileVersionParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field           | input                           | errors
      ${'version'}    | ${{ version: 1 }}               | ${stringError}
      ${'version'}    | ${{ version: '1.2.not-valid' }} | ${'version must be a Semantic Versioning Specification'}
      ${'platform'}   | ${{ platform: 'not-valid' }}    | ${'does not exist in "Platform" enum'}
      ${'minVersion'} | ${{ minVersion: 'not-valid' }}  | ${'Boolean cannot represent a non boolean value'}
    `(
      /* eslint-enable max-len */
      `should fail to create an org since $field is not valid`,
      async (params) => {
        const createMobileVersionParams: CreateMobileVersionParams =
          generateCreateMobileVersionParams(params.input);
        await handler.mutations.createMobileVersion({
          createMobileVersionParams,
          missingFieldError: params.errors,
        });
      },
    );

    test.each`
      field         | error
      ${'version'}  | ${`Field "version" of required type "String!" was not provided.`}
      ${'platform'} | ${`Field "platform" of required type "Platform!" was not provided.`}
    `(
      `should fail to update faulty mobileVersions since mandatory field $field is missing`,
      async (params) => {
        const updateMinMobileVersionParams: UpdateMinMobileVersionParams =
          generateUpdateMinMobileVersionParams();
        delete updateMinMobileVersionParams[params.field];
        await handler.mutations.updateMinMobileVersion({
          updateMinMobileVersionParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field         | input                           | error
      ${'version'}  | ${{ version: 1 }}               | ${stringError}
      ${'version'}  | ${{ version: '1.2.not-valid' }} | ${'version must be a Semantic Versioning Specification'}
      ${'platform'} | ${{ platform: 'not-valid' }}    | ${'does not exist in "Platform" enum'}
    `(
      /* eslint-enable max-len */
      `should fail to create an org since $field is not valid`,
      async (params) => {
        const updateMinMobileVersionParams: UpdateMinMobileVersionParams =
          generateUpdateMinMobileVersionParams(params.input);
        await handler.mutations.updateMinMobileVersion({
          updateMinMobileVersionParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      field         | error
      ${'versions'} | ${`Field "versions" of required type "[String!]!" was not provided.`}
      ${'platform'} | ${`Field "platform" of required type "Platform!" was not provided.`}
    `(
      `should fail to update min mobileVersion since mandatory field $field is missing`,
      async (params) => {
        const updateFaultyMobileVersionsParams: UpdateFaultyMobileVersionsParams =
          generateUpdateFaultyMobileVersionsParams();
        delete updateFaultyMobileVersionsParams[params.field];
        await handler.mutations.updateFaultyMobileVersions({
          updateFaultyMobileVersionsParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field         | input                                       | errors
      ${'versions'} | ${{ versions: [1] }}                        | ${stringError}
      ${'versions'} | ${{ versions: ['1.2.not-valid'] }}          | ${'each value in versions must be a Semantic Versioning Specification'}
      ${'versions'} | ${{ versions: ['1.2.1', '1.2.not-valid'] }} | ${'each value in versions must be a Semantic Versioning Specification'}
      ${'platform'} | ${{ platform: 'not-valid' }}                | ${'does not exist in "Platform" enum'}
    `(
      /* eslint-enable max-len */
      `should fail to create an org since $field is not valid`,
      async (params) => {
        const updateFaultyMobileVersionsParams: UpdateFaultyMobileVersionsParams =
          generateUpdateFaultyMobileVersionsParams(params.input);
        await handler.mutations.updateFaultyMobileVersions({
          updateFaultyMobileVersionsParams,
          missingFieldError: params.errors,
        });
      },
    );
  });
});
