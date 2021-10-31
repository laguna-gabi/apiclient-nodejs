import { ApolloServerTestClient } from 'apollo-server-testing';
import gql from 'graphql-tag';
import { camelCase } from 'lodash';
import { DailyReportCategoriesInput } from '../../src/dailyReport';
import {
  Appointment,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../../src/appointment';
import { AvailabilityInput } from '../../src/availability';
import { Identifier, Identifiers, RegisterForNotificationParams } from '../../src/common';
import {
  CancelNotifyParams,
  CreateMemberParams,
  CreateTaskParams,
  Member,
  NotifyParams,
  SetGeneralNotesParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '../../src/member';
import { CreateOrgParams } from '../../src/org';
import { CreateUserParams } from '../../src/user';

const FRAGMENT_APPOINTMENT = gql`
  fragment appointmentFragment on Appointment {
    id
    userId
    memberId
    notBefore
    status
    method
    start
    end
    noShow
    noShowReason
    notes {
      recap
      strengths
      userActionItem
      memberActionItem
      scores {
        adherence
        adherenceText
        wellbeing
        wellbeingText
      }
    }
    updatedAt
    link
  }
`;

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
  }): Promise<Member> => {
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
            address {
              street
              city
              state
            }
            scores {
              adherence
              adherenceText
              wellbeing
              wellbeingText
            }
            org {
              id
              name
              type
              trialDuration
              zipCode
            }
            primaryUserId
            users {
              id
              firstName
              lastName
              email
              roles
              avatar
              description
              createdAt
              phone
              title
              maxCustomers
              languages
              appointments {
                id
                notBefore
                method
                status
                start
                end
                link
                noShow
                noShowReason
                notes {
                  recap
                  strengths
                  userActionItem
                  memberActionItem
                  scores {
                    adherence
                    adherenceText
                    wellbeing
                    wellbeingText
                  }
                }
              }
            }
            sex
            email
            language
            zipCode
            utcDelta
            dischargeDate
            goals {
              id
              title
              status
              deadline
            }
            actionItems {
              id
              title
              status
              deadline
            }
            fellowName
            drgDesc
            readmissionRisk
            phoneSecondary
            generalNotes
            admitDate
            createdAt
            honorific
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
            ...appointmentFragment
          }
        }
        ${FRAGMENT_APPOINTMENT}
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
            ...appointmentFragment
          }
        }
        ${FRAGMENT_APPOINTMENT}
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.scheduleAppointment
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
  }): Promise<Appointment> => {
    const result = await this.apolloClient.mutate({
      variables: { endAppointmentParams },
      mutation: gql`
        mutation EndAppointment($endAppointmentParams: EndAppointmentParams!) {
          endAppointment(endAppointmentParams: $endAppointmentParams) {
            ...appointmentFragment
          }
        }
        ${FRAGMENT_APPOINTMENT}
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.endAppointment
    );
  };

  updateNotes = async ({
    updateNotesParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateNotesParams: UpdateNotesParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Notes> => {
    const result = await this.apolloClient.mutate({
      variables: { updateNotesParams },
      mutation: gql`
        mutation updateNotes($updateNotesParams: UpdateNotesParams!) {
          updateNotes(updateNotesParams: $updateNotesParams) {
            recap
            strengths
            userActionItem
            memberActionItem
            scores {
              adherence
              adherenceText
              wellbeing
              wellbeingText
            }
          }
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateNotes
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

  archiveMember = async ({
    id,
    invalidFieldsErrors,
  }: { id?: string; invalidFieldsErrors?: string[] } = {}): Promise<Identifiers> => {
    const result = await this.apolloClient.mutate({
      variables: { id: id },
      mutation: gql`
        mutation archiveMember($id: String!) {
          archiveMember(id: $id)
        }
      `,
    });

    return this.isResultValid({ result, invalidFieldsErrors }) && result.data.archiveMember;
  };

  deleteMember = async ({
    id,
    invalidFieldsErrors,
  }: { id?: string; invalidFieldsErrors?: string[] } = {}): Promise<Identifiers> => {
    const result = await this.apolloClient.mutate({
      variables: { id: id },
      mutation: gql`
        mutation deleteMember($id: String!) {
          deleteMember(id: $id)
        }
      `,
    });

    return this.isResultValid({ result, invalidFieldsErrors }) && result.data.deleteMember;
  };

  notify = async ({
    notifyParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    notifyParams: NotifyParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { notifyParams: notifyParams },
      mutation: gql`
        mutation notify($notifyParams: NotifyParams!) {
          notify(notifyParams: $notifyParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.notify
    );
  };

  cancel = async ({
    cancelNotifyParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    cancelNotifyParams: CancelNotifyParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { cancelNotifyParams: cancelNotifyParams },
      mutation: gql`
        mutation cancelNotify($cancelNotifyParams: CancelNotifyParams!) {
          cancelNotify(cancelNotifyParams: $cancelNotifyParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.cancelNotify
    );
  };

  updateRecording = async ({
    updateRecordingParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateRecordingParams?: UpdateRecordingParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { updateRecordingParams: updateRecordingParams },
      mutation: gql`
        mutation updateRecording($updateRecordingParams: UpdateRecordingParams!) {
          updateRecording(updateRecordingParams: $updateRecordingParams)
        }
      `,
    });

    return (
      this.isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateRecording
    );
  };

  setDailyReportCategories = async ({
    dailyReportCategoriesInput,
  }: {
    dailyReportCategoriesInput: DailyReportCategoriesInput;
  }) => {
    const result = await this.apolloClient.mutate({
      variables: { dailyReportCategoriesInput },
      mutation: gql`
        mutation setDailyReportCategories(
          $dailyReportCategoriesInput: DailyReportCategoriesInput!
        ) {
          setDailyReportCategories(dailyReportCategoriesInput: $dailyReportCategoriesInput) {
            categories {
              rank
              category
            }
            memberId
            date
            statsOverThreshold
          }
        }
      `,
    });

    const { errors, data } = result || {};
    return { errors, updatedDailyReport: data?.setDailyReportCategories };
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
