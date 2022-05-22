import { defaultUserParams } from '@argus/hepiusClient';
import { generateId } from '@argus/pandora';
import { lorem } from 'faker';
import * as request from 'supertest';
import { v4 } from 'uuid';
import {
  BEFORE_ALL_TIMEOUT,
  generateCreateUserParams,
  generateRandomName,
  generateRequestHeaders,
  urls,
} from '..';
import { ErrorType, Errors, maxLength, minLength } from '../../src/common';
import { CreateUserParams, GetSlotsParams, UpdateUserParams } from '../../src/user';
import { Handler } from '../aux';
import { generateGetSlotsParams, generateUpdateUserParams } from '../generators';

const stringError = `String cannot represent a non string value`;

describe('Validations - user', () => {
  const handler: Handler = new Handler();
  let server;

  beforeAll(async () => {
    await handler.beforeAll();
    server = handler.app.getHttpServer();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  test.each`
    field          | error
    ${'email'}     | ${`Field "email" of required type "String!" was not provided.`}
    ${'firstName'} | ${`Field "firstName" of required type "String!" was not provided.`}
    ${'lastName'}  | ${`Field "lastName" of required type "String!" was not provided.`}
    ${'phone'}     | ${`Field "phone" of required type "String!" was not provided.`}
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

  test.each`
    length           | errorString | field
    ${minLength - 1} | ${'short'}  | ${'firstName'}
    ${maxLength + 1} | ${'long'}   | ${'firstName'}
    ${minLength - 1} | ${'short'}  | ${'lastName'}
    ${maxLength + 1} | ${'long'}   | ${'lastName'}
  `(`should fail to update a user since $field is too $errorString`, async (params) => {
    const updateUserParams: UpdateUserParams = generateUpdateUserParams();
    updateUserParams[params.field] = generateRandomName(params.length);

    await handler.mutations.updateUser({
      updateUserParams,
      invalidFieldsErrors: [Errors.get(ErrorType.userMinMaxLength)],
      requestHeaders: handler.defaultAdminRequestHeaders,
    });
  });

  /* eslint-disable max-len */
  test.each`
    field            | input                           | errors
    ${'email'}       | ${{ email: lorem.word() }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat)] }}
    ${'avatar'}      | ${{ avatar: lorem.word() }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userAvatarFormat)] }}
    ${'email & avatar'} | ${{
  email: lorem.word(),
  avatar: lorem.word(),
}} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userEmailFormat), Errors.get(ErrorType.userAvatarFormat)] }}
    ${'description'} | ${{ description: 222 }}         | ${{ missingFieldError: stringError }}
    ${'firstName'}   | ${{ firstName: 222 }}           | ${{ missingFieldError: stringError }}
    ${'lastName'}    | ${{ lastName: 222 }}            | ${{ missingFieldError: stringError }}
    ${'roles'}       | ${{ roles: [222] }}             | ${{ missingFieldError: 'does not exist in "UserRole" enum.' }}
    ${'phone'}       | ${{ phone: 222 }}               | ${{ missingFieldError: stringError }}
    ${'phone'}       | ${{ phone: '+410' }}            | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userPhone)] }}
    ${'title'}       | ${{ title: 222 }}               | ${{ missingFieldError: stringError }}
    ${'maxMembers'}  | ${{ maxMembers: lorem.word() }} | ${{ missingFieldError: 'Float cannot represent non numeric value' }}
    ${'languages'}   | ${{ languages: lorem.word() }}  | ${{ missingFieldError: 'does not exist in "Language" enum.' }}
    ${'orgs'}        | ${{ orgs: ['not-valid'] }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.orgIdInvalid)] }}
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

  /* eslint-disable max-len */
  test.each`
    field            | input                           | errors
    ${'avatar'}      | ${{ avatar: lorem.word() }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userAvatarFormat)] }}
    ${'description'} | ${{ description: 222 }}         | ${{ missingFieldError: stringError }}
    ${'firstName'}   | ${{ firstName: 222 }}           | ${{ missingFieldError: stringError }}
    ${'lastName'}    | ${{ lastName: 222 }}            | ${{ missingFieldError: stringError }}
    ${'roles'}       | ${{ roles: [222] }}             | ${{ missingFieldError: 'does not exist in "UserRole" enum.' }}
    ${'title'}       | ${{ title: 222 }}               | ${{ missingFieldError: stringError }}
    ${'maxMembers'}  | ${{ maxMembers: lorem.word() }} | ${{ missingFieldError: 'Float cannot represent non numeric value' }}
    ${'languages'}   | ${{ languages: lorem.word() }}  | ${{ missingFieldError: 'does not exist in "Language" enum.' }}
    ${'orgs'}        | ${{ orgs: ['not-valid'] }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.orgIdInvalid)] }}
  `(
    /* eslint-enable max-len */
    `should fail to update a user since $field is not valid`,
    async (params) => {
      const updateUserParams: UpdateUserParams = generateUpdateUserParams(params.input);
      await handler.mutations.updateUser({
        updateUserParams,
        ...params.errors,
        requestHeaders: handler.defaultAdminRequestHeaders,
      });
    },
  );

  test.each`
    field           | defaultValue
    ${'maxMembers'} | ${defaultUserParams.maxMembers}
    ${'languages'}  | ${defaultUserParams.languages}
    ${'avatar'}     | ${defaultUserParams.avatar}
    ${'roles'}      | ${defaultUserParams.roles}
  `(`should set default value if exists for optional field $field`, async (params) => {
    /* eslint-enable max-len */
    const createUserParams: CreateUserParams = generateCreateUserParams();
    delete createUserParams[params.field];

    handler.cognitoService.spyOnCognitoServiceAddUser.mockResolvedValueOnce({
      authId: v4(),
      username: v4(),
    });
    const { authId } = await handler.mutations.createUser({ createUserParams });

    const response = await handler.queries.getUser({
      requestHeaders: generateRequestHeaders(authId),
    });
    expect(response[params.field]).not.toBeUndefined();
    expect(response[params.field]).toEqual(params.defaultValue);
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

  test.each`
    field              | input                       | errors
    ${'appointmentId'} | ${{ appointmentId: 123 }}   | ${stringError}
    ${'appointmentId'} | ${{ appointmentId: '123' }} | ${Errors.get(ErrorType.appointmentIdInvalid)}
  `(`should fail to request slots since $field is not valid`, async (params) => {
    await handler.queries.getUserSlotsByAppointmentId(params.input, params.errors);
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
