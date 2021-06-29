import { INestApplication } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import gql from 'graphql-tag';
import { AppModule } from '../../src/app.module';
import {
  generateCreateCoachParams,
  generateCreateMemberParams,
} from '../index';
import { CoachRole, CreateCoachParams } from '../../src/coach/coach.dto';
import { CreateMemberParams } from '../../src/member/member.dto';

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

  it('Should be able to create a coach, a nurse and a member of both', async () => {
    const coachParams: CreateCoachParams = generateCreateCoachParams();
    const primaryCoachId = await mutationCreateCoach(coachParams);
    const coachParamsNurse: CreateCoachParams = generateCreateCoachParams(
      CoachRole.nurse,
    );
    const nurseCoachId = await mutationCreateCoach(coachParamsNurse);

    const resultCoach = await queryGetCoach(primaryCoachId);
    expect(resultCoach).toEqual({ ...coachParams, id: primaryCoachId });
    const resultNurse = await queryGetCoach(nurseCoachId);
    expect(resultNurse).toEqual({ ...coachParamsNurse, id: nurseCoachId });

    const memberParams = generateCreateMemberParams(primaryCoachId, [
      nurseCoachId,
    ]);

    const id = await mutationCreateMember(memberParams);
    expect(id).not.toBeNull();

    const { name, phoneNumber, primaryCoach, coaches } = await queryGetMember(
      id,
    );

    expect(name).toEqual(memberParams.name);
    expect(phoneNumber).toEqual(memberParams.phoneNumber);
    expect(primaryCoach).toEqual({ ...coachParams, id: primaryCoachId });
    expect(coaches).toEqual([{ ...coachParamsNurse, id: nurseCoachId }]);
  });

  const mutationCreateCoach = async (
    coachParams: CreateCoachParams,
  ): Promise<string> => {
    const resultCreateCoach = await apolloClient.mutate({
      variables: { createCoachParams: coachParams },
      mutation: gql`
        mutation CreateCoach($createCoachParams: CreateCoachParams!) {
          createCoach(createCoachParams: $createCoachParams) {
            id
          }
        }
      `,
    });
    const { id } = resultCreateCoach.data.createCoach;
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

  const queryGetCoach = async (id: string) => {
    const resultGetCoach = await apolloClient.query({
      variables: { id },
      query: gql`
        query getCoach($id: String!) {
          getCoach(id: $id) {
            id
            name
            email
            role
            photoUrl
          }
        }
      `,
    });
    return resultGetCoach.data.getCoach;
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
            coaches {
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
