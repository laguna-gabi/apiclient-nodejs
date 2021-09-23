import { Handler } from '../aux/handler';
import { AvailabilityInput } from '../../src/availability';
import { generateAvailabilityInput } from '../generators';

const stringError = `String cannot represent a non string value`;

describe('Validations - availability', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field       | error
    ${'userId'} | ${`Field "userId" of required type "String!" was not provided.`}
    ${'start'}  | ${`Field "start" of required type "DateTime!" was not provided.`}
    ${'end'}    | ${`Field "end" of required type "DateTime!" was not provided.`}
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
    field       | input                     | errors
    ${'userId'} | ${{ userId: 1 }}          | ${stringError}
    ${'start'}  | ${{ start: 'not-valid' }} | ${'Cast to date failed for value "Invalid Date" (type Date)'}
    ${'end'}    | ${{ end: 'not-valid' }}   | ${'Cast to date failed for value "Invalid Date" (type Date)'}
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
});
