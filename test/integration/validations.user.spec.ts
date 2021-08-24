import { generateCreateUserParams, generateRandomName, urls } from '../index';
import { CreateUserParams, defaultUserParams } from '../../src/user';
import * as config from 'config';
import * as faker from 'faker';
import { Errors, ErrorType } from '../../src/common';
import { Handler } from './aux/handler';
import { GetSlotsParams } from '../../src/user/slot.dto';
import { generateGetSlotsParams } from '../generators';
import * as request from 'supertest';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - user', () => {
  const handler: Handler = new Handler();
  let server;

  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    await handler.beforeAll();
    server = handler.app.getHttpServer();
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
    ${'phone'}       | ${`Field "phone" of required type "String!" was not provided.`}
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
    ${'firstName'}      | ${{ firstName: 222 }}                                        | ${{ missingFieldError: stringError }}
    ${'lastName'}       | ${{ lastName: 222 }}                                         | ${{ missingFieldError: stringError }}
    ${'roles'}          | ${{ roles: [222] }}                                          | ${{ missingFieldError: 'does not exist in "UserRole" enum.' }}
    ${'phone'}          | ${{ phone: 222 }}                                            | ${{ missingFieldError: stringError }}
    ${'phone'}          | ${{ phone: '+410' }}                                         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userPhone)] }}
    ${'title'}          | ${{ title: 222 }}                                            | ${{ missingFieldError: stringError }}
    ${'maxCustomers'}   | ${{ maxCustomers: faker.lorem.word() }}                      | ${{ missingFieldError: 'Float cannot represent non numeric value' }}
    ${'languages'}      | ${{ languages: faker.lorem.word() }}                         | ${{ missingFieldError: 'does not exist in "Language" enum.' }}
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

  test.each`
    field             | defaultValue
    ${'maxCustomers'} | ${defaultUserParams.maxCustomers}
    ${'languages'}    | ${defaultUserParams.languages}
  `(`should set default value if exists for optional field $field`, async (params) => {
    /* eslint-enable max-len */
    const userParams: CreateUserParams = generateCreateUserParams();
    delete userParams[params.field];

    const { id } = await handler.mutations.createUser({ userParams });

    const user = await handler.queries.getUser(id);
    expect(user[params.field]).not.toBeUndefined();
    expect(user[params.field]).toEqual(params.defaultValue);
  });

  test.each`
    field              | input                     | errors
    ${'appointmentId'} | ${{ appointmentId: 123 }} | ${stringError}
    ${'notBefore'}     | ${{ notBefore: 'asd' }}   | ${'must be a Date instance'}
  `(`should fail to request slots since $field is not valid`, async (params) => {
    const getSlotsParams: GetSlotsParams = generateGetSlotsParams(params.input);

    await handler.queries.getUserSlots(getSlotsParams, params.errors);
  });

  it('rest: should return 404 on no appointmentId given', async () => {
    await request(server).get(urls.slots).expect(404);
  });
});
