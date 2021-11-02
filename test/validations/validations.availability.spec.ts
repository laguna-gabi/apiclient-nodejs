import { v4 } from 'uuid';
import { AvailabilityInput } from '../../src/availability';
import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux/handler';
import { generateAvailabilityInput } from '../generators';

describe('Validations - availability', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field      | error
    ${'start'} | ${`Field "start" of required type "DateTime!" was not provided.`}
    ${'end'}   | ${`Field "end" of required type "DateTime!" was not provided.`}
  `(
    `should fail to create an availability since mandatory field $field is missing`,
    async (params) => {
      const availability: AvailabilityInput = generateAvailabilityInput();
      delete availability[params.field];
      await handler.setContextUserId(v4()).mutations.createAvailabilities({
        availabilities: [availability],
        missingFieldError: params.error,
      });
    },
  );

  /* eslint-disable max-len */
  test.each`
    field      | input                     | errors
    ${'start'} | ${{ start: 'not-valid' }} | ${'Cast to date failed for value "Invalid Date" (type Date)'}
    ${'end'}   | ${{ end: 'not-valid' }}   | ${'Cast to date failed for value "Invalid Date" (type Date)'}
  `(
    /* eslint-enable max-len */
    `should fail to create an availability since $field is not valid`,
    async (params) => {
      const availability: AvailabilityInput = generateAvailabilityInput(params.input);
      await handler.setContextUserId(v4()).mutations.createAvailabilities({
        availabilities: [availability],
        missingFieldError: params.errors,
      });
    },
  );

  it('should throw an error for not userId in context', async () => {
    const availability: AvailabilityInput = generateAvailabilityInput();
    await handler.setContextUserId(undefined).mutations.createAvailabilities({
      availabilities: [availability],
      invalidFieldsErrors: [Errors.get(ErrorType.userNotFound)],
    });
  });
});
