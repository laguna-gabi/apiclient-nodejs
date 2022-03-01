import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux';
import { generateGetCommunicationParams } from '../generators';

const stringError = `String cannot represent a non string value`;

describe('Validations - communication', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field         | error
    ${'userId'}   | ${`Field "userId" of required type "String!" was not provided.`}
    ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
  `(`should fail to get communication since mandatory field $field is missing`, async (params) => {
    const getCommunicationParams = generateGetCommunicationParams();
    delete getCommunicationParams[params.field];
    await handler.queries.getCommunication({
      getCommunicationParams,
      missingFieldError: params.error,
    });
  });

  /* eslint-disable max-len */
  test.each`
    field         | input              | errors
    ${'userId'}   | ${{ userId: 1 }}   | ${stringError}
    ${'memberId'} | ${{ memberId: 1 }} | ${stringError}
  `(`should fail to get communication since $field is invalid (missing)`, async (params) => {
    const getCommunicationParams = generateGetCommunicationParams(params.input);
    await handler.queries.getCommunication({
      getCommunicationParams,
      missingFieldError: params.errors,
    });
  });

  test.each`
    field         | input                | invalid
    ${'memberId'} | ${{ memberId: '1' }} | ${[Errors.get(ErrorType.memberIdInvalid)]}
    ${'userId'}   | ${{ userId: '1' }}   | ${[Errors.get(ErrorType.userIdInvalid)]}
  `(`should fail to get communication since $field is not valid`, async (params) => {
    const getCommunicationParams = generateGetCommunicationParams(params.input);
    await handler.queries.getCommunication({
      getCommunicationParams,
      invalidFieldsErrors: params.invalid,
    });
  });
});
