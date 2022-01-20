import { ApolloServerTestClient } from 'apollo-server-testing';
import { GraphQLResponse } from 'graphql-extensions';
import gql from 'graphql-tag';
import { camelCase } from 'lodash';
import {
  Appointment,
  EndAppointmentParams,
  Notes,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../../src/appointment';
import { AvailabilityInput } from '../../src/availability';
import {
  Identifier,
  Identifiers,
  RegisterForNotificationParams,
  isGQLResultValid as isResultValid,
} from '../../src/common';
import { DailyReportCategoriesInput } from '../../src/dailyReport';
import {
  AddCaregiverParams,
  CancelNotifyParams,
  Caregiver,
  CompleteMultipartUploadParams,
  CreateMemberParams,
  CreateTaskParams,
  Journal,
  Member,
  NotifyContentParams,
  NotifyParams,
  Recording,
  ReplaceUserForMemberParams,
  SetGeneralNotesParams,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
  UpdateTaskStatusParams,
} from '../../src/member';
import { CreateOrgParams } from '../../src/org';
import { CreateTodoParams, DeleteTodoParams, EndAndCreateTodoParams, Todo } from '../../src/todo';
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
    recordingConsent
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.createUser
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.createOrg
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.createMember
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
            phoneSecondary
            generalNotes
            admitDate
            createdAt
            honorific
            readmissionRisk
            readmissionRiskHistory {
              readmissionRisk
              date
            }
          }
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.updateMember
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.endAppointment
    );
  };

  deleteAppointment = async ({ id }: { id: string }): Promise<GraphQLResponse> =>
    await this.apolloClient.mutate({
      variables: { id: id },
      mutation: gql`
        mutation deleteAppointment($id: String!) {
          deleteAppointment(id: $id)
        }
      `,
    });

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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.updateNotes
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.createGoal
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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

    return isResultValid({ result, invalidFieldsErrors }) && result.data.deleteAvailability;
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.setGeneralNotes
    );
  };

  createJournal = async (): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      mutation: gql`
        mutation createJournal {
          createJournal {
            id
          }
        }
      `,
    });

    return result.data.createJournal;
  };

  updateJournalText = async ({
    updateJournalTextParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateJournalTextParams: UpdateJournalTextParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      variables: { updateJournalTextParams },
      mutation: gql`
        mutation updateJournalText($updateJournalTextParams: UpdateJournalTextParams!) {
          updateJournalText(updateJournalTextParams: $updateJournalTextParams) {
            id
            memberId
            text
            published
            updatedAt
          }
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateJournalText
    );
  };

  deleteJournal = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation deleteJournal($id: String!) {
          deleteJournal(id: $id)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.deleteJournal
    );
  };

  deleteJournalImage = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation deleteJournalImage($id: String!) {
          deleteJournalImage(id: $id)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.deleteJournalImage
    );
  };

  deleteJournalAudio = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation deleteJournalAudio($id: String!) {
          deleteJournalAudio(id: $id)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.deleteJournalAudio
    );
  };

  publishJournal = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Journal> => {
    const result = await this.apolloClient.mutate({
      variables: { id },
      mutation: gql`
        mutation publishJournal($id: String!) {
          publishJournal(id: $id)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.publishJournal
    );
  };

  updateMemberConfig = async ({
    updateMemberConfigParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateMemberConfigParams: UpdateMemberConfigParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { updateMemberConfigParams: updateMemberConfigParams },
      mutation: gql`
        mutation updateMemberConfig($updateMemberConfigParams: UpdateMemberConfigParams!) {
          updateMemberConfig(updateMemberConfigParams: $updateMemberConfigParams)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.updateMemberConfig
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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

    return isResultValid({ result, invalidFieldsErrors }) && result.data.archiveMember;
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

    return isResultValid({ result, invalidFieldsErrors }) && result.data.deleteMember;
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

    return isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.notify;
  };

  notifyContent = async ({
    notifyContentParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    notifyContentParams: NotifyContentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const result = await this.apolloClient.mutate({
      variables: { notifyContentParams: notifyContentParams },
      mutation: gql`
        mutation notifyContent($notifyContentParams: NotifyContentParams!) {
          notifyContent(notifyContentParams: $notifyContentParams)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.notifyContent
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
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.cancelNotify
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
  }): Promise<Recording> => {
    const result = await this.apolloClient.mutate({
      variables: { updateRecordingParams: updateRecordingParams },
      mutation: gql`
        mutation updateRecording($updateRecordingParams: UpdateRecordingParams!) {
          updateRecording(updateRecordingParams: $updateRecordingParams) {
            id
            userId
            memberId
            start
            end
            answered
            phone
            recordingType
            deletedMedia
            review {
              userId
              content
              createdAt
              updatedAt
            }
          }
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
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

  replaceUserForMember = async ({
    replaceUserForMemberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    replaceUserForMemberParams: ReplaceUserForMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }) => {
    const result = await this.apolloClient.mutate({
      variables: { replaceUserForMemberParams: replaceUserForMemberParams },
      mutation: gql`
        mutation replaceUserForMember($replaceUserForMemberParams: ReplaceUserForMemberParams!) {
          replaceUserForMember(replaceUserForMemberParams: $replaceUserForMemberParams)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.replaceUserForMemberParams
    );
  };

  addCaregiver = async ({
    addCaregiverParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    addCaregiverParams: AddCaregiverParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Caregiver> => {
    const result = await this.apolloClient.mutate({
      variables: { addCaregiverParams: addCaregiverParams },
      mutation: gql`
        mutation addCaregiver($addCaregiverParams: AddCaregiverParams!) {
          addCaregiver(addCaregiverParams: $addCaregiverParams) {
            id
            email
            firstName
            lastName
            relationship
            phone
            memberId
          }
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) && result.data.addCaregiver
    );
  };

  dismissAlert = async ({
    alertId,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    alertId: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<boolean> => {
    const result = await this.apolloClient.mutate({
      variables: { alertId },
      mutation: gql`
        mutation dismissAlert($alertId: String!) {
          dismissAlert(alertId: $alertId)
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) && result.data.dismissAlert
    );
  };

  setLastQueryAlert = async ({
    missingFieldError,
    invalidFieldsErrors,
  }: {
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<boolean> => {
    const result = await this.apolloClient.mutate({
      mutation: gql`
        mutation setLastQueryAlert {
          setLastQueryAlert
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.setLastQueryAlert
    );
  };

  updateCaregiver = async ({
    updateCaregiverParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateCaregiverParams: UpdateCaregiverParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Caregiver> => {
    const result = await this.apolloClient.mutate({
      variables: { updateCaregiverParams: updateCaregiverParams },
      mutation: gql`
        mutation updateCaregiver($updateCaregiverParams: UpdateCaregiverParams!) {
          updateCaregiver(updateCaregiverParams: $updateCaregiverParams) {
            id
            email
            firstName
            lastName
            relationship
            phone
            memberId
          }
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.updateCaregiver
    );
  };

  deleteCaregiver = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    id: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<boolean> => {
    const result = await this.apolloClient.mutate({
      variables: { id: id },
      mutation: gql`
        mutation deleteCaregiver($id: String!) {
          deleteCaregiver(id: $id)
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.deleteCaregiver
    );
  };

  completeMultipartUpload = async ({
    completeMultipartUploadParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    completeMultipartUploadParams?: CompleteMultipartUploadParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<boolean> => {
    const result = await this.apolloClient.mutate({
      variables: { completeMultipartUploadParams },
      mutation: gql`
        mutation completeMultipartUpload(
          $completeMultipartUploadParams: CompleteMultipartUploadParams!
        ) {
          completeMultipartUpload(completeMultipartUploadParams: $completeMultipartUploadParams)
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.deleteCaregiver
    );
  };

  createTodo = async ({
    createTodoParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    createTodoParams: CreateTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
    const result = await this.apolloClient.mutate({
      variables: { createTodoParams },
      mutation: gql`
        mutation createTodo($createTodoParams: CreateTodoParams!) {
          createTodo(createTodoParams: $createTodoParams) {
            id
          }
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.createTodo
    );
  };

  endAndCreateTodo = async ({
    endAndCreateTodoParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    endAndCreateTodoParams: EndAndCreateTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Todo> => {
    const result = await this.apolloClient.mutate({
      variables: { endAndCreateTodoParams },
      mutation: gql`
        mutation endAndCreateTodo($endAndCreateTodoParams: EndAndCreateTodoParams!) {
          endAndCreateTodo(endAndCreateTodoParams: $endAndCreateTodoParams) {
            id
            memberId
            text
            label
            cronExpressions
            start
            end
            status
            createdBy
            updatedBy
            deletedBy
          }
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.endAndCreateTodo
    );
  };

  deleteTodo = async ({
    deleteTodoParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    deleteTodoParams: DeleteTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<boolean> => {
    const result = await this.apolloClient.mutate({
      variables: { deleteTodoParams },
      mutation: gql`
        mutation deleteTodo($deleteTodoParams: DeleteTodoParams!) {
          deleteTodo(deleteTodoParams: $deleteTodoParams)
        }
      `,
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) && result.data.deleteTodo
    );
  };
}
