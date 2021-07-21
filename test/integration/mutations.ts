import { camelCase } from 'lodash';
import gql from 'graphql-tag';
import { CreateUserParams } from '../../src/user';
import { CreateMemberParams } from '../../src/member';
import { ApolloServerTestClient } from 'apollo-server-testing';
import {
  Appointment,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  SetNotesParams,
  NoShowParams,
} from '../../src/appointment';
import { Identifier } from '../../src/common';
import { CreateOrgParams } from '../../src/org';

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

    if (this.isResultValid({ result, missingFieldError, invalidFieldsErrors })) {
      const { id } = result.data.createUser;
      return id;
    }
  };

  createOrg = async ({
    orgParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    orgParams: CreateOrgParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
    const result = await this.apolloClient.mutate({
      variables: { createOrgParams: orgParams },
      mutation: gql`
        mutation CreateOrg($createOrgParams: CreateOrgParams!) {
          createOrg(createOrgParams: $createOrgParams) {
            id
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createOrg
    );
  };

  createMember = async ({
    memberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    memberParams: CreateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
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

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createMember
    );
  };

  requestAppointment = async ({
    appointmentParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    appointmentParams: RequestAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { requestAppointmentParams: appointmentParams },
      mutation: gql`
        mutation RequestAppointment($requestAppointmentParams: RequestAppointmentParams!) {
          requestAppointment(requestAppointmentParams: $requestAppointmentParams) {
            id
            memberId
            userId
            notBefore
            method
            status
            start
            end
            updatedAt
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.requestAppointment
    );
  };

  scheduleAppointment = async ({
    appointmentParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    appointmentParams: ScheduleAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { scheduleAppointmentParams: appointmentParams },
      mutation: gql`
        mutation ScheduleAppointment($scheduleAppointmentParams: ScheduleAppointmentParams!) {
          scheduleAppointment(scheduleAppointmentParams: $scheduleAppointmentParams) {
            id
            memberId
            userId
            notBefore
            method
            status
            start
            end
            updatedAt
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.scheduleAppointment
    );
  };

  endAppointment = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation EndAppointment($id: String!) {
          endAppointment(id: $id) {
            id
            memberId
            userId
            notBefore
            method
            status
            start
            end
            updatedAt
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.endAppointment
    );
  };

  freezeAppointment = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation FreezeAppointment($id: String!) {
          freezeAppointment(id: $id) {
            id
            memberId
            userId
            notBefore
            method
            status
            start
            end
            updatedAt
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.freezeAppointment
    );
  };

  noShowAppointment = async ({
    noShowParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    noShowParams: NoShowParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { noShowParams: noShowParams },
      mutation: gql`
        mutation NoShowAppointment($noShowParams: NoShowParams!) {
          noShowAppointment(noShowParams: $noShowParams) {
            id
            memberId
            userId
            notBefore
            method
            status
            start
            end
            updatedAt
            noShow {
              noShow
              reason
            }
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.noShowAppointment
    );
  };

  setNotes = async ({
    params,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    params: SetNotesParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
    const result = await this.apolloClient.mutate({
      variables: { params: params },
      mutation: gql`
        mutation SetNotes($params: SetNotesParams!) {
          setNotes(params: $params)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.setNotes
    );
  };

  isResultValid = ({ result, invalidFieldsErrors, missingFieldError }): boolean => {
    if (invalidFieldsErrors) {
      for (let i = 0; i < invalidFieldsErrors.length; i++) {
        expect(invalidFieldsErrors[i]).toEqual(result.errors[0][i].message);
        expect(result.errors[0][i].code).not.toEqual(-1);
      }
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
      expect(result.errors[0].code).toEqual(-1);
    } else {
      return true;
    }

    return false;
  };
}
