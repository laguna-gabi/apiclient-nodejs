import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import gql from 'graphql-tag';
import { AppModule } from '../../src/app.module';
import { generateCreateUserParams, generateCreateMemberParams } from '../index';
import { UserRole, CreateUserParams } from '../../src/user/user.schema';
import { CreateMemberParams } from '../../src/member/member.schema';

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
    const nurseParams: CreateUserParams = generateCreateUserParams(
      UserRole.nurse,
    );
    const nurseId = await mutationCreateUser(nurseParams);

    const resultUser = await queryGetUser(primaryCoachId);
    expect(resultUser).toEqual({ ...userParams, id: primaryCoachId });
    const resultNurse = await queryGetUser(nurseId);
    expect(resultNurse).toEqual({ ...nurseParams, id: nurseId });

    const memberParams = generateCreateMemberParams(primaryCoachId, [nurseId]);

    const id = await mutationCreateMember(memberParams);
    expect(id).not.toBeNull();

    const { name, phoneNumber, primaryCoach, users } = await queryGetMember(id);

    expect(name).toEqual(memberParams.name);
    expect(phoneNumber).toEqual(memberParams.phoneNumber);
    expect(primaryCoach).toEqual({ ...userParams, id: primaryCoachId });
    expect(users).toEqual([{ ...nurseParams, id: nurseId }]);
  });

  const mutationCreateUser = async (
    userParams: CreateUserParams,
  ): Promise<string> => {
    const resultCreateUser = await apolloClient.mutate({
      variables: { createUserParams: userParams },
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
            role
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
            name
            phoneNumber
            primaryCoach {
              id
              name
              email
              role
              photoUrl
            }
            users {
              id
              name
              email
              role
              photoUrl
            }
          }
        }
      `,
    });

    return resultGetMember.data.getMember;
  };
});
