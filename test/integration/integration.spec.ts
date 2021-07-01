import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { createTestClient } from 'apollo-server-testing';
import { AppModule } from '../../src/app.module';
import { generateCreateMemberParams, generateCreateUserParams } from '../index';
import { CreateUserParams, User, UserRole } from '../../src/user/user.dto';
import { camelCase, omit } from 'lodash';
import { Mutations } from './mutations';
import { Queries } from './queries';
import * as config from 'config';
import * as faker from 'faker';
import { CreateMemberParams } from '../../src/member/member.dto';
import { ObjectID } from 'bson';

const validatorsConfig = config.get('graphql.validators');

describe('Integration graphql resolvers', () => {
  let app: INestApplication;
  let mutations: Mutations;
  let queries: Queries;

  const primaryCoachId = new ObjectID().toString();
  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;
  const minError = `name must be longer than or equal to ${minLength} characters`;
  const maxError = `name must be shorter than or equal to ${maxLength} characters`;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    const module: GraphQLModule =
      moduleFixture.get<GraphQLModule>(GraphQLModule);

    const apolloServer = createTestClient((module as any).apolloServer);
    mutations = new Mutations(apolloServer);
    queries = new Queries(apolloServer);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully be able to complete a flow : create a user, a nurse and a member of both', async () => {
    const userParams: CreateUserParams = generateCreateUserParams();
    const primaryCoachId = await mutations.createUser({ userParams });
    const nurseAndCoachParams: CreateUserParams = generateCreateUserParams({
      roles: [UserRole.nurse, UserRole.coach],
    });
    const nurseId = await mutations.createUser({
      userParams: nurseAndCoachParams,
    });

    const resultUser = await queries.getUser(primaryCoachId);
    compareUsers(resultUser, { ...userParams, id: primaryCoachId });
    const resultNurse = await queries.getUser(nurseId);
    compareUsers(resultNurse, { ...nurseAndCoachParams, id: nurseId });

    const memberParams = generateCreateMemberParams({
      primaryCoachId,
      usersIds: [nurseId],
    });

    const id = await mutations.createMember({ memberParams });

    const { name, phoneNumber, primaryCoach, users } = await queries.getMember(
      id,
    );

    expect(phoneNumber).toEqual(memberParams.phoneNumber);
    expect(name).toEqual(memberParams.name);
    expect(primaryCoach).toEqual(resultUser);
    expect(users).toEqual([resultNurse]);
  });

  const compareUsers = (resultUser: User, expectedUser: User) => {
    const resultUserNew = omit(resultUser, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expectedUserNew);

    expect(resultUser.roles).toEqual(
      expectedUser.roles.map((role) => camelCase(role)),
    );
  };

  describe('validations', () => {
    describe('user', () => {
      test.each`
        field         | error
        ${'email'}    | ${`Field "email" of required type "String!" was not provided.`}
        ${'name'}     | ${`Field "name" of required type "String!" was not provided.`}
        ${'roles'}    | ${`Field "roles" of required type "[UserRole!]!" was not provided.`}
        ${'photoUrl'} | ${`Field "photoUrl" of required type "String!" was not provided.`}
      `(
        `should fail to create a user since mandatory field $field is missing`,
        async (params) => {
          const userParams: CreateUserParams = generateCreateUserParams();
          delete userParams[params.field];
          await mutations.createUser({
            userParams,
            missingFieldError: params.error,
          });
        },
      );

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${minError}
        ${maxLength + 1} | ${'long'}   | ${maxError}
      `(
        `should fail to create a user since name is too $errorString`,
        async (params) => {
          const name = generateRandomName(params.length);
          const userParams: CreateUserParams = generateCreateUserParams({
            name,
          });
          await mutations.createUser({
            userParams,
            invalidFieldsErrors: [params.error],
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        field                 | input                                                          | errors
        ${'email'}            | ${{ email: faker.lorem.word() }}                               | ${['email must be an email']}
        ${'photoUrl'}         | ${{ photoUrl: faker.lorem.word() }}                            | ${['photoUrl must be an URL address']}
        ${'email & photoUrl'} | ${{ email: faker.lorem.word(), photoUrl: faker.lorem.word() }} | ${['photoUrl must be an URL address', 'email must be an email']}
      `(
        /* eslint-enable max-len */
        `should fail to create a user since $field is not valid`,
        async (params) => {
          const userParams: CreateUserParams = generateCreateUserParams(
            params.input,
          );
          await mutations.createUser({
            userParams,
            invalidFieldsErrors: params.errors,
          });
        },
      );
    });

    describe('member', () => {
      test.each`
        field               | error
        ${'phoneNumber'}    | ${`Field "phoneNumber" of required type "String!" was not provided.`}
        ${'name'}           | ${`Field "name" of required type "String!" was not provided.`}
        ${'dateOfBirth'}    | ${`Field "dateOfBirth" of required type "DateTime!" was not provided.`}
        ${'primaryCoachId'} | ${`Field "primaryCoachId" of required type "String!" was not provided.`}
      `(
        `should fail to create a user since mandatory field $field is missing`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            primaryCoachId,
          });
          delete memberParams[params.field];
          await mutations.createMember({
            memberParams,
            missingFieldError: params.error,
          });
        },
      );

      test.each`
        length           | errorString | error
        ${minLength - 1} | ${'short'}  | ${minError}
        ${maxLength + 1} | ${'long'}   | ${maxError}
      `(
        `should fail to create a member since name is too $errorString`,
        async (params) => {
          const name = generateRandomName(params.length);
          const memberParams: CreateMemberParams = generateCreateMemberParams({
            primaryCoachId,
            name,
          });
          await mutations.createMember({
            memberParams,
            invalidFieldsErrors: [params.error],
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        field            | input                                                  | errors
        ${'phoneNumber'} | ${{ primaryCoachId, phoneNumber: '+410' }}             | ${['phoneNumber must be a valid phone number']}
        ${'dateOfBirth'} | ${{ primaryCoachId, dateOfBirth: faker.lorem.word() }} | ${['dateOfBirth must be a Date instance']}
      `(
        /* eslint-enable max-len */
        `should fail to create a member since $field is not valid`,
        async (params) => {
          const memberParams: CreateMemberParams = generateCreateMemberParams(
            params.input,
          );
          await mutations.createMember({
            memberParams,
            invalidFieldsErrors: params.errors,
          });
        },
      );
    });

    const generateRandomName = (length: number): string => {
      return faker.lorem.words(length).substr(0, length);
    };
  });
});
