import { CreateUserParams } from '../../src/user/user.dto';
import { camelCase } from 'lodash';
import gql from 'graphql-tag';
import { CreateMemberParams } from '../../src/member/member.dto';
import { ApolloServerTestClient } from 'apollo-server-testing';

export class Mutations {
  constructor(private readonly apolloClient: ApolloServerTestClient) {}

  createUser = async ({
    userParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    userParams: CreateUserParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<string> => {
    const result = await this.apolloClient.mutate({
      variables: {
        createUserParams: {
          ...userParams,
          roles: userParams.roles?.map((role) => camelCase(role)),
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

    if (!this.checkErrors({ result, missingFieldError, invalidFieldsErrors })) {
      const { id } = result.data.createUser;
      return id;
    }
  };

  createMember = async ({
    memberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    memberParams: CreateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<string> => {
    const result = await this.apolloClient.mutate({
      variables: { createMemberParams: memberParams },
      mutation: gql`
        mutation CreateMember($createMemberParams: CreateMemberParams!) {
          createMember(createMemberParams: $createMemberParams) {
            id
          }
        }
      `,
    });

    if (!this.checkErrors({ result, missingFieldError, invalidFieldsErrors })) {
      const { id } = result.data.createMember;
      return id;
    }
  };

  checkErrors = ({
    result,
    invalidFieldsErrors,
    missingFieldError,
  }): boolean => {
    if (invalidFieldsErrors) {
      expect(invalidFieldsErrors.sort()).toEqual(result.errors[0].message);
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
    } else {
      return false;
    }

    return true;
  };
}
