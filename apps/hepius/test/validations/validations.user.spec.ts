import { lorem } from 'faker';
import * as request from 'supertest';
import { ErrorType, Errors, maxLength, minLength } from '../../src/common';
import { CreateUserParams, GetSlotsParams, defaultUserParams } from '../../src/user';
import { Handler } from '../aux';
import { generateGetSlotsParams, generateId } from '../generators';
import {
  generateCreateUserParams,
  generateRandomName,
  generateRequestHeaders,
  urls,
} from '../index';

const stringError = `String cannot represent a non string value`;

describe('Validations - user', () => {
  const handler: Handler = new Handler();
  let server;

  beforeAll(async () => {
    await handler.beforeAll();
    server = handler.app.getHttpServer();
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field          | error
    ${'email'}     | ${`Field "email" of required type "String!" was not provided.`}
    ${'firstName'} | ${`Field "firstName" of required type "String!" was not provided.`}
    ${'lastName'}  | ${`Field "lastName" of required type "String!" was not provided.`}
    ${'phone'}     | ${`Field "phone" of required type "String!" was not provided.`}
    ${'authId'}    | ${`Field "authId" of required type "String!" was not provided.`}
    ${'orgs'}      | ${`Field "orgs" of required type "[String!]!" was not provided.`}
  `(`should fail to create a user since mandatory field $field is missing`, async (params) => {
    const createUserParams: CreateUserParams = generateCreateUserParams();
    delete createUserParams[params.field];
    await handler.mutations.createUser({
      createUserParams,
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
    const createUserParams: CreateUserParams = generateCreateUserParams();
    createUserParams[params.field] = generateRandomName(params.length);

    await handler.mutations.createUser({
      createUserParams,
      invalidFieldsErrors: [Errors.get(ErrorType.userMinMaxLength)],
    });
  });

  /* eslint-disable max-len */
  test.each`
    field             | input                             | errors
    ${'email'}        | ${{ email: lorem.word() }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat)] }}
    ${'avatar'}       | ${{ avatar: lorem.word() }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userAvatarFormat)] }}
    ${'email & avatar'} | ${{
  email: lorem.word(),
  avatar: lorem.word(),
}} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userAvatarFormat)] }}
    ${'description'}  | ${{ description: 222 }}           | ${{ missingFieldError: stringError }}
    ${'firstName'}    | ${{ firstName: 222 }}             | ${{ missingFieldError: stringError }}
    ${'lastName'}     | ${{ lastName: 222 }}              | ${{ missingFieldError: stringError }}
    ${'roles'}        | ${{ roles: [222] }}               | ${{ missingFieldError: 'does not exist in "UserRole" enum.' }}
    ${'phone'}        | ${{ phone: 222 }}                 | ${{ missingFieldError: stringError }}
    ${'phone'}        | ${{ phone: '+410' }}              | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userPhone)] }}
    ${'title'}        | ${{ title: 222 }}                 | ${{ missingFieldError: stringError }}
    ${'maxCustomers'} | ${{ maxCustomers: lorem.word() }} | ${{ missingFieldError: 'Float cannot represent non numeric value' }}
    ${'languages'}    | ${{ languages: lorem.word() }}    | ${{ missingFieldError: 'does not exist in "Language" enum.' }}
    ${'orgs'}         | ${{ orgs: ['not-valid'] }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.orgIdInvalid)] }}
  `(
    /* eslint-enable max-len */
    `should fail to create a user since $field is not valid`,
    async (params) => {
      const createUserParams: CreateUserParams = generateCreateUserParams(params.input);
      await handler.mutations.createUser({
        createUserParams,
        ...params.errors,
      });
    },
  );

  test.each`
    field             | defaultValue
    ${'maxCustomers'} | ${defaultUserParams.maxCustomers}
    ${'languages'}    | ${defaultUserParams.languages}
    ${'avatar'}       | ${defaultUserParams.avatar}
    ${'roles'}        | ${defaultUserParams.roles}
  `(`should set default value if exists for optional field $field`, async (params) => {
    /* eslint-enable max-len */
    const createUserParams: CreateUserParams = generateCreateUserParams();
    delete createUserParams[params.field];

    await handler.mutations.createUser({ createUserParams });

    const user = await handler.queries.getUser({
      requestHeaders: generateRequestHeaders(createUserParams.authId),
    });
    expect(user[params.field]).not.toBeUndefined();
    expect(user[params.field]).toEqual(params.defaultValue);
  });

  /* eslint-disable max-len */
  test.each`
    field              | input                       | errors
    ${'appointmentId'} | ${{ appointmentId: 123 }}   | ${stringError}
    ${'appointmentId'} | ${{ appointmentId: '123' }} | ${Errors.get(ErrorType.appointmentIdInvalid)}
    ${'userId'}        | ${{ userId: 123 }}          | ${stringError}
    ${'userId'}        | ${{ userId: '123' }}        | ${Errors.get(ErrorType.userIdInvalid)}
    ${'notBefore'} | ${{
  notBefore: 'asd',
  userId: generateId(),
}} | ${'must be a Date instance'}
    ${'both ID'} | ${{
  appointmentId: generateId(),
  userId: generateId(),
}} | ${Errors.get(ErrorType.slotsParams)}
    ${'no ID'}         | ${{}}                       | ${Errors.get(ErrorType.slotsParams)}
  `(`should fail to request slots since $field is not valid`, async (params) => {
    const getSlotsParams: GetSlotsParams = generateGetSlotsParams(params.input);

    await handler.queries.getUserSlots(getSlotsParams, params.errors);
  });

  it('should throw error on non existing userConfig', async () => {
    await handler.queries.getUserConfig({
      id: generateId(),
      invalidFieldsError: Errors.get(ErrorType.userNotFound),
    });
  });

  test.each`
    field   | input  | error
    ${'id'} | ${123} | ${'String cannot represent a non string value'}
  `(`should fail to getUserConfig since $field is not valid,`, async (params) => {
    await handler.queries.getUserConfig({
      id: params.input,
      invalidFieldsError: params.error,
    });
  });

  it('rest: should return 404 on no appointmentId given', async () => {
    await request(server).get(urls.slots).expect(404);
  });

  it('rest: should return 400 on non existing appointmentId', async () => {
    const result = await request(server).get(`${urls.slots}/${generateId()}`).expect(400);
    expect(result).toEqual(
      expect.objectContaining({
        text: '{"statusCode":400,"message":"user id was not found"}',
      }),
    );
  });

  it('rest: should return 400 on bad appointmentId', async () => {
    const result = await request(server).get(`${urls.slots}/not-valid`).expect(400);
    expect(result).toEqual(
      expect.objectContaining({
        text: '{"statusCode":400,"message":"Argument passed in must be a string of 12 bytes or a string of 24 hex characters"}',
      }),
    );
  });
});
