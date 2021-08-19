import { camelCase } from 'lodash';
import gql from 'graphql-tag';
import { CreateUserParams } from '../../../src/user';
import {
  CreateMemberParams,
  CreateTaskParams,
  SetGeneralNotesParams,
  UpdateMemberParams,
  UpdateTaskStatusParams,
} from '../../../src/member';
import { ApolloServerTestClient } from 'apollo-server-testing';
import {
  Appointment,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  EndAppointmentParams,
} from '../../../src/appointment';
import { Identifier, Identifiers, RegisterForNotificationParams } from '../../../src/common';
import { CreateOrgParams } from '../../../src/org';
import { AvailabilityInput } from '../../../src/availability';

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
  }): Promise<Identifier> => {
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

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createUser
    );
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

  updateMember = async ({
    updateMemberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateMemberParams: UpdateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { updateMemberParams: updateMemberParams },
      mutation: gql`
        mutation UpdateMember($updateMemberParams: UpdateMemberParams!) {
          updateMember(updateMemberParams: $updateMemberParams) {
            id
            phone
            deviceId
            firstName
            lastName
            dateOfBirth
            sex
            email
            language
            zipCode
            dischargeDate
            fellowName
            drgDesc
            readmissionRisk
            phoneSecondary
            admitDate
            address {
              street
              city
              state
            }
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateMember
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
            link
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
            link
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

  endAppointment = async ({
    endAppointmentParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    endAppointmentParams: EndAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
    const result = await this.apolloClient.mutate({
      variables: { endAppointmentParams },
      mutation: gql`
        mutation EndAppointment($endAppointmentParams: EndAppointmentParams!) {
          endAppointment(endAppointmentParams: $endAppointmentParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.endAppointment
    );
  };

  createGoal = async ({
    createTaskParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    createTaskParams: CreateTaskParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<string> => {
    const result = await this.apolloClient.mutate({
      variables: { createTaskParams: createTaskParams },
      mutation: gql`
        mutation CreateGoal($createTaskParams: CreateTaskParams!) {
          createGoal(createTaskParams: $createTaskParams) {
            id
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createGoal
    );
  };

  updateGoalStatus = async ({
    updateTaskStatusParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateTaskStatusParams: UpdateTaskStatusParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }) => {
    const result = await this.apolloClient.mutate({
      variables: { updateTaskStatusParams: updateTaskStatusParams },
      mutation: gql`
        mutation UpdateGoalStatus($updateTaskStatusParams: UpdateTaskStatusParams!) {
          updateGoalStatus(updateTaskStatusParams: $updateTaskStatusParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateGoalStatus
    );
  };

  createActionItem = async ({
    createTaskParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    createTaskParams: CreateTaskParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<string> => {
    const result = await this.apolloClient.mutate({
      variables: { createTaskParams: createTaskParams },
      mutation: gql`
        mutation CreateActionItem($createTaskParams: CreateTaskParams!) {
          createActionItem(createTaskParams: $createTaskParams) {
            id
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createActionItem
    );
  };

  updateActionItemStatus = async ({
    updateTaskStatusParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateTaskStatusParams: UpdateTaskStatusParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }) => {
    const result = await this.apolloClient.mutate({
      variables: { updateTaskStatusParams: updateTaskStatusParams },
      mutation: gql`
        mutation UpdateActionItemStatus($updateTaskStatusParams: UpdateTaskStatusParams!) {
          updateActionItemStatus(updateTaskStatusParams: $updateTaskStatusParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateGoalStatus
    );
  };

  createAvailabilities = async ({
    availabilities,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    availabilities: AvailabilityInput[];
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifiers> => {
    const result = await this.apolloClient.mutate({
      variables: { availabilities: availabilities },
      mutation: gql`
        mutation createAvailabilities($availabilities: [AvailabilityInput!]!) {
          createAvailabilities(availabilities: $availabilities) {
            ids
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.createAvailabilities
    );
  };

  deleteAvailability = async ({
    id,
    invalidFieldsErrors,
  }: {
    id: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifiers> => {
    const result = await this.apolloClient.mutate({
      variables: { id: id },
      mutation: gql`
        mutation deleteAvailability($id: String!) {
          deleteAvailability(id: $id)
        }
      `,
    });

    return this.isResultValid({ result, invalidFieldsErrors }) && result.data.deleteAvailability;
  };

  setGeneralNotes = async ({
    setGeneralNotesParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    setGeneralNotesParams: SetGeneralNotesParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { setGeneralNotesParams: setGeneralNotesParams },
      mutation: gql`
        mutation setGeneralNotes($setGeneralNotesParams: SetGeneralNotesParams!) {
          setGeneralNotes(setGeneralNotesParams: $setGeneralNotesParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.setGeneralNotes
    );
  };

  registerMemberForNotifications = async ({
    registerForNotificationParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    registerForNotificationParams: RegisterForNotificationParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { registerForNotificationParams: registerForNotificationParams },
      mutation: gql`
        mutation registerMemberForNotifications(
          $registerForNotificationParams: RegisterForNotificationParams!
        ) {
          registerMemberForNotifications(
            registerForNotificationParams: $registerForNotificationParams
          )
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.registerMemberForNotifications
    );
  };

  isResultValid = ({ result, invalidFieldsErrors, missingFieldError = undefined }): boolean => {
    if (invalidFieldsErrors) {
      for (let i = 0; i < invalidFieldsErrors.length; i++) {
        expect(invalidFieldsErrors[i]).toEqual(
          result.errors[0][i]?.message || result.errors[0]?.message,
        );
        expect(result.errors[0][i]?.code || result.errors[0]?.code).not.toEqual(-1);
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
