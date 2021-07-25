import { generateCreateUserParams, generateRandomName } from '../index';
import { CreateUserParams } from '../../src/user';
import * as config from 'config';
import * as faker from 'faker';
import { Errors, ErrorType } from '../../src/common';
import { Handler } from './aux/handler';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - user', () => {
  const handler: Handler = new Handler();

  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field            | error
    ${'email'}       | ${`Field "email" of required type "String!" was not provided.`}
    ${'firstName'}   | ${`Field "firstName" of required type "String!" was not provided.`}
    ${'lastName'}    | ${`Field "lastName" of required type "String!" was not provided.`}
    ${'roles'}       | ${`Field "roles" of required type "[UserRole!]!" was not provided.`}
    ${'avatar'}      | ${`Field "avatar" of required type "String!" was not provided.`}
    ${'description'} | ${`Field "description" of required type "String!" was not provided.`}
  `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
    const userParams: CreateUserParams = generateCreateUserParams();
    delete userParams[params.field];
    await handler.mutations.createUser({
      userParams,
      missingFieldError: params.error,
    });
  });

  test.each`
    length           | errorString | field
    ${minLength - 1} | ${'short'}  | ${'firstName'}
    ${maxLength + 1} | ${'long'}   | ${'firstName'}
    ${minLength - 1} | ${'short'}  | ${'lastName'}
    ${maxLength + 1} | ${'long'}   | ${'lastName'}
  `(`should fail to create a user since $field is too $errorString`, async (params) => {
    const userParams: CreateUserParams = generateCreateUserParams();
    userParams[params.field] = generateRandomName(params.length);

    await handler.mutations.createUser({
      userParams,
      invalidFieldsErrors: [Errors.get(ErrorType.userMinMaxLength)],
    });
  });

  /* eslint-disable max-len */
  test.each`
    field               | input                                                        | errors
    ${'email'}          | ${{ email: faker.lorem.word() }}                             | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat)] }}
    ${'avatar'}         | ${{ avatar: faker.lorem.word() }}                            | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userAvatarFormat)] }}
    ${'email & avatar'} | ${{ email: faker.lorem.word(), avatar: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userAvatarFormat)] }}
    ${'description'}    | ${{ description: 222 }}                                      | ${{ missingFieldError: stringError }}
  `(
    /* eslint-enable max-len */
    `should fail to create a user since $field is not valid`,
    async (params) => {
      const userParams: CreateUserParams = generateCreateUserParams(params.input);
      await handler.mutations.createUser({
        userParams,
        ...params.errors,
      });
    },
  );
});
