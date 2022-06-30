import { BEFORE_ALL_TIMEOUT, stringError } from '..';
import { AvailabilityInput } from '../../src/availability';
import { ErrorType, Errors } from '../../src/common';
import { Handler } from '../aux';
import { generateAvailabilityInput } from '../generators';

describe('Validations - availability', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, BEFORE_ALL_TIMEOUT);

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
      await handler.mutations.createAvailabilities({
        availabilities: [availability],
        missingFieldError: params.error,
      });
    },
  );

  /* eslint-disable max-len */
  test.each`
    field      | input                                      | errors
    ${'start'} | ${{ start: 'not-valid', end: new Date() }} | ${'Cast to date failed for value "Invalid Date" (type Date)'}
    ${'end'}   | ${{ end: 'not-valid' }}                    | ${'Cast to date failed for value "Invalid Date" (type Date)'}
  `(
    /* eslint-enable max-len */
    `should fail to create an availability since $field is not valid`,
    async (params) => {
      const availability: AvailabilityInput = generateAvailabilityInput(params.input);
      await handler.mutations.createAvailabilities({
        availabilities: [availability],
        missingFieldError: params.errors,
      });
    },
  );

  test.each`
    field        | error
    ${'123'}     | ${Errors.get(ErrorType.availabilityIdInvalid)}
    ${123}       | ${stringError}
    ${undefined} | ${`Variable \"$id\" of required type \"String!\" was not provided.`}
  `(
    `should fail to create an appointment since id filed with value $field is invalid`,
    async (params) => {
      await handler.mutations.deleteAvailability({
        id: params.field,
        invalidFieldsError: params.error,
      });
    },
  );
});
