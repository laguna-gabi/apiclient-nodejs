import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux/handler';
import { generateGetCommunicationParams, generateId } from '../generators';

const stringError = `String cannot represent a non string value`;

describe('Validations - communication', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

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

  test.each`
    field         | input              | errors
    ${'userId'}   | ${{ userId: 1 }}   | ${stringError}
    ${'memberId'} | ${{ memberId: 1 }} | ${stringError}
  `(`should fail to get communication since $field is not valid`, async (params) => {
    const getCommunicationParams = generateGetCommunicationParams(params.input);
    await handler.queries.getCommunication({
      getCommunicationParams,
      missingFieldError: params.errors,
    });
  });

  it('should fail to to get member unread messages since id not valid', async () => {
    await handler.queries.getMemberUnreadMessagesCount({
      memberId: 123,
      missingFieldError: stringError,
    });
  });

  it('should fail to to get member unread messages since member does not exists', async () => {
    await handler.setContextUserId(generateId()).queries.getMemberUnreadMessagesCount({
      invalidFieldsError: Errors.get(ErrorType.communicationMemberUserNotFound),
    });
  });
});
