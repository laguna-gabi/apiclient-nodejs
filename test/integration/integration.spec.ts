import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import gql from 'graphql-tag';
import { AppModule } from '../../src/app.module';
import { generateCreateMemberParams, generateCreateUserParams } from '../index';
import { CreateUserParams, User, UserRole } from '../../src/user/user.dto';
import { CreateMemberParams } from '../../src/member/member.dto';
import { camelCase, omit } from 'lodash';

describe('Integration graphql resolvers', () => {
  let app: INestApplication;
  let apolloClient: ApolloServerTestClient;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const module: GraphQLModule =
      moduleFixture.get<GraphQLModule>(GraphQLModule);
    apolloClient = createTestClient((module as any).apolloServer);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Should be able to create a user, a nurse and a member of both', async () => {
    const userParams: CreateUserParams = generateCreateUserParams();
    const primaryCoachId = await mutationCreateUser(userParams);
    const nurseAndCoachParams: CreateUserParams = generateCreateUserParams([
      UserRole.nurse,
      UserRole.coach,
    ]);
    const nurseId = await mutationCreateUser(nurseAndCoachParams);

    const resultUser = await queryGetUser(primaryCoachId);
    compareUsers(resultUser, { ...userParams, id: primaryCoachId });
    const resultNurse = await queryGetUser(nurseId);
    compareUsers(resultNurse, { ...nurseAndCoachParams, id: nurseId });

    const memberParams = generateCreateMemberParams(primaryCoachId, [nurseId]);

    const id = await mutationCreateMember(memberParams);
    expect(id).not.toBeNull();

    const { name, phoneNumber, primaryCoach, users } = await queryGetMember(id);

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

  const mutationCreateUser = async (
    userParams: CreateUserParams,
  ): Promise<string> => {
    const resultCreateUser = await apolloClient.mutate({
      variables: {
        createUserParams: {
          ...userParams,
          roles: userParams.roles.map((role) => camelCase(role)),
        },
      },
      mutation: gql`
        mutation CreateUser($createUserParams: CreateUserParams!) {
          createUser(createUserParams: $createUserParams) {
            id
          }
        }
      `,
    });
    const { id } = resultCreateUser.data.createUser;
    expect(id).not.toBeNull();

    return id;
  };

  const mutationCreateMember = async (
    memberParams: CreateMemberParams,
  ): Promise<string> => {
    const resultMember = await apolloClient.mutate({
      variables: { createMemberParams: memberParams },
      mutation: gql`
        mutation CreateMember($createMemberParams: CreateMemberParams!) {
          createMember(createMemberParams: $createMemberParams) {
            id
          }
        }
      `,
    });
    const { id } = resultMember.data.createMember;
    return id;
  };

  const queryGetUser = async (id: string) => {
    const resultGetUser = await apolloClient.query({
      variables: { id },
      query: gql`
        query getUser($id: String!) {
          getUser(id: $id) {
            id
            name
            email
            roles
            photoUrl
          }
        }
      `,
    });
    return resultGetUser.data.getUser;
  };

  const queryGetMember = async (id: string) => {
    const resultGetMember = await apolloClient.query({
      variables: { id },
      query: gql`
        query getMember($id: String!) {
          getMember(id: $id) {
            id
            phoneNumber
            name
            dateOfBirth
            primaryCoach {
              id
              name
              email
              roles
              photoUrl
            }
            users {
              id
              name
              email
              roles
              photoUrl
            }
          }
        }
      `,
    });

    return resultGetMember.data.getMember;
  };
});
