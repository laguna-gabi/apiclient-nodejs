import { camelCase } from 'lodash';
import gql from 'graphql-tag';
import { CreateUserParams } from '../../src/user';
import { CreateMemberParams } from '../../src/member';
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
      for (let i = 0; i < invalidFieldsErrors.length; i++) {
        expect(invalidFieldsErrors[i]).toEqual(result.errors[0][i].message);
        expect(result.errors[0][i].code).not.toEqual(-1);
      }
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
      expect(result.errors[0].code).toEqual(-1);
    } else {
      return false;
    }

    return true;
  };
}
