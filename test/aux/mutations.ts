import { GraphQLClient } from 'graphql-request';
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
  CreateCarePlanParams,
  RedFlag,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '../../src/care';
import { Identifier, Identifiers, RegisterForNotificationParams } from '../../src/common';
import { DailyReportCategoriesInput } from '../../src/dailyReport';
import {
  AddCaregiverParams,
  CancelNotifyParams,
  Caregiver,
  CompleteMultipartUploadParams,
  CreateMemberParams,
  CreateTaskParams,
  DeleteMemberParams,
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
import {
  CreateQuestionnaireParams,
  QuestionnaireResponse,
  SubmitQuestionnaireResponseParams,
} from '../../src/questionnaire';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  Todo,
} from '../../src/todo';
import { CreateUserParams } from '../../src/user';
import { isResultValid } from '..';
import { SubmitCareWizardParams } from '../../src/care/wizard.dto';

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
  constructor(
    private readonly client: GraphQLClient,
    private readonly defaultUserRequestHeaders,
    private readonly defaultAdminRequestHeaders,
  ) {}

  createUser = async ({
    userParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    userParams: CreateUserParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createUser } = await this.client
      .request(
        gql`
          mutation CreateUser($createUserParams: CreateUserParams!) {
            createUser(createUserParams: $createUserParams) {
              id
            }
          }
        `,
        {
          createUserParams: {
            ...userParams,
            roles: userParams.roles?.map((role) => camelCase(role)),
          },
        },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createUser;
  };

  createOrg = async ({
    orgParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    orgParams: CreateOrgParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createOrg } = await this.client
      .request(
        gql`
          mutation CreateOrg($createOrgParams: CreateOrgParams!) {
            createOrg(createOrgParams: $createOrgParams) {
              id
            }
          }
        `,
        { createOrgParams: orgParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createOrg;
  };

  createMember = async ({
    memberParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberParams: CreateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createMember } = await this.client
      .request(
        gql`
          mutation CreateMember($createMemberParams: CreateMemberParams!) {
            createMember(createMemberParams: $createMemberParams) {
              id
            }
          }
        `,
        { createMemberParams: memberParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createMember;
  };

  updateMember = async ({
    updateMemberParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateMemberParams: UpdateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Member> => {
    const { updateMember } = await this.client
      .request(
        gql`
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
        { updateMemberParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateMember;
  };

  requestAppointment = async ({
    appointmentParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    appointmentParams: RequestAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Appointment> => {
    const { requestAppointment } = await this.client
      .request(
        gql`
          mutation RequestAppointment($requestAppointmentParams: RequestAppointmentParams!) {
            requestAppointment(requestAppointmentParams: $requestAppointmentParams) {
              ...appointmentFragment
            }
          }
          ${FRAGMENT_APPOINTMENT}
        `,
        { requestAppointmentParams: appointmentParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return requestAppointment;
  };

  scheduleAppointment = async ({
    appointmentParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    appointmentParams: ScheduleAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Appointment> => {
    const { scheduleAppointment } = await this.client
      .request(
        gql`
          mutation ScheduleAppointment($scheduleAppointmentParams: ScheduleAppointmentParams!) {
            scheduleAppointment(scheduleAppointmentParams: $scheduleAppointmentParams) {
              ...appointmentFragment
            }
          }
          ${FRAGMENT_APPOINTMENT}
        `,
        { scheduleAppointmentParams: appointmentParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return scheduleAppointment;
  };

  endAppointment = async ({
    endAppointmentParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    endAppointmentParams: EndAppointmentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Appointment> => {
    const { endAppointment } = await this.client
      .request(
        gql`
          mutation EndAppointment($endAppointmentParams: EndAppointmentParams!) {
            endAppointment(endAppointmentParams: $endAppointmentParams) {
              ...appointmentFragment
            }
          }
          ${FRAGMENT_APPOINTMENT}
        `,
        { endAppointmentParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return endAppointment;
  };

  deleteAppointment = async ({
    id,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    id: string;
    requestHeaders?;
  }): Promise<boolean> => {
    const { deleteAppointment } = await this.client.request(
      gql`
        mutation deleteAppointment($id: String!) {
          deleteAppointment(id: $id)
        }
      `,
      { id },
      requestHeaders,
    );

    return deleteAppointment;
  };

  updateNotes = async ({
    updateNotesParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateNotesParams: UpdateNotesParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Notes> => {
    const { updateNotes } = await this.client
      .request(
        gql`
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
        { updateNotesParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateNotes;
  };

  createActionItem = async ({
    createTaskParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createTaskParams: CreateTaskParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createActionItem } = await this.client
      .request(
        gql`
          mutation CreateActionItem($createTaskParams: CreateTaskParams!) {
            createActionItem(createTaskParams: $createTaskParams) {
              id
            }
          }
        `,
        { createTaskParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createActionItem;
  };

  updateActionItemStatus = async ({
    updateTaskStatusParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateTaskStatusParams: UpdateTaskStatusParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }) => {
    const { updateActionItemStatus } = await this.client
      .request(
        gql`
          mutation UpdateActionItemStatus($updateTaskStatusParams: UpdateTaskStatusParams!) {
            updateActionItemStatus(updateTaskStatusParams: $updateTaskStatusParams)
          }
        `,
        { updateTaskStatusParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateActionItemStatus;
  };

  createAvailabilities = async ({
    availabilities,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    availabilities: AvailabilityInput[];
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifiers> => {
    const { createAvailabilities } = await this.client
      .request(
        gql`
          mutation createAvailabilities($availabilities: [AvailabilityInput!]!) {
            createAvailabilities(availabilities: $availabilities) {
              ids
            }
          }
        `,
        { availabilities },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createAvailabilities;
  };

  deleteAvailability = async ({
    id,
    invalidFieldsErrors,
  }: {
    id: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifiers> => {
    const { deleteAvailability } = await this.client
      .request(
        gql`
          mutation deleteAvailability($id: String!) {
            deleteAvailability(id: $id)
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          invalidFieldsErrors,
        });
      });

    return deleteAvailability;
  };

  setGeneralNotes = async ({
    setGeneralNotesParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    setGeneralNotesParams: SetGeneralNotesParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<void> => {
    const { setGeneralNotes } = await this.client
      .request(
        gql`
          mutation setGeneralNotes($setGeneralNotesParams: SetGeneralNotesParams!) {
            setGeneralNotes(setGeneralNotesParams: $setGeneralNotesParams)
          }
        `,
        { setGeneralNotesParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return setGeneralNotes;
  };

  createJournal = async ({ requestHeaders }: { requestHeaders }): Promise<Journal> => {
    const { createJournal } = await this.client.request(
      gql`
        mutation createJournal {
          createJournal {
            id
          }
        }
      `,
      undefined,
      requestHeaders,
    );

    return createJournal;
  };

  updateJournalText = async ({
    updateJournalTextParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    updateJournalTextParams: UpdateJournalTextParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Journal> => {
    const { updateJournalText } = await this.client
      .request(
        gql`
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
        { updateJournalTextParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateJournalText;
  };

  deleteJournal = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Journal> => {
    const { deleteJournal } = await this.client
      .request(
        gql`
          mutation deleteJournal($id: String!) {
            deleteJournal(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteJournal;
  };

  deleteJournalImage = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Journal> => {
    const { deleteJournalImage } = await this.client
      .request(
        gql`
          mutation deleteJournalImage($id: String!) {
            deleteJournalImage(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteJournalImage;
  };

  deleteJournalAudio = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Journal> => {
    const { deleteJournalAudio } = await this.client
      .request(
        gql`
          mutation deleteJournalAudio($id: String!) {
            deleteJournalAudio(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteJournalAudio;
  };

  publishJournal = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Journal> => {
    const { publishJournal } = await this.client
      .request(
        gql`
          mutation publishJournal($id: String!) {
            publishJournal(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return publishJournal;
  };

  updateMemberConfig = async ({
    updateMemberConfigParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateMemberConfigParams: UpdateMemberConfigParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<void> => {
    const { updateMemberConfig } = await this.client
      .request(
        gql`
          mutation updateMemberConfig($updateMemberConfigParams: UpdateMemberConfigParams!) {
            updateMemberConfig(updateMemberConfigParams: $updateMemberConfigParams)
          }
        `,
        { updateMemberConfigParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateMemberConfig;
  };

  registerMemberForNotifications = async ({
    registerForNotificationParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    registerForNotificationParams: RegisterForNotificationParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<void> => {
    const { registerMemberForNotifications } = await this.client
      .request(
        gql`
          mutation registerMemberForNotifications(
            $registerForNotificationParams: RegisterForNotificationParams!
          ) {
            registerMemberForNotifications(
              registerForNotificationParams: $registerForNotificationParams
            )
          }
        `,
        { registerForNotificationParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return registerMemberForNotifications;
  };

  deleteMember = async ({
    deleteMemberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    deleteMemberParams: DeleteMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const { deleteMember } = await this.client
      .request(
        gql`
          mutation deleteMember($deleteMemberParams: DeleteMemberParams!) {
            deleteMember(deleteMemberParams: $deleteMemberParams)
          }
        `,
        { deleteMemberParams },
        this.defaultAdminRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteMember;
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
    const { notify } = await this.client
      .request(
        gql`
          mutation notify($notifyParams: NotifyParams!) {
            notify(notifyParams: $notifyParams)
          }
        `,
        { notifyParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return notify;
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
    const { notifyContent } = await this.client
      .request(
        gql`
          mutation notifyContent($notifyContentParams: NotifyContentParams!) {
            notifyContent(notifyContentParams: $notifyContentParams)
          }
        `,
        { notifyContentParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return notifyContent;
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
    const { cancelNotify } = await this.client
      .request(
        gql`
          mutation cancelNotify($cancelNotifyParams: CancelNotifyParams!) {
            cancelNotify(cancelNotifyParams: $cancelNotifyParams)
          }
        `,
        { cancelNotifyParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return cancelNotify;
  };

  updateRecording = async ({
    updateRecordingParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateRecordingParams?: UpdateRecordingParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Recording> => {
    const { updateRecording } = await this.client
      .request(
        gql`
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
        { updateRecordingParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateRecording;
  };

  setDailyReportCategories = async ({
    dailyReportCategoriesInput,
    requestHeaders,
  }: {
    dailyReportCategoriesInput: DailyReportCategoriesInput;
    requestHeaders;
  }) => {
    const { setDailyReportCategories } = await this.client.request(
      gql`
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
      { dailyReportCategoriesInput },
      requestHeaders,
    );

    return setDailyReportCategories;
  };

  replaceUserForMember = async ({
    replaceUserForMemberParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultAdminRequestHeaders,
  }: {
    replaceUserForMemberParams: ReplaceUserForMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }) => {
    const { replaceUserForMember } = await this.client
      .request(
        gql`
          mutation replaceUserForMember($replaceUserForMemberParams: ReplaceUserForMemberParams!) {
            replaceUserForMember(replaceUserForMemberParams: $replaceUserForMemberParams)
          }
        `,
        { replaceUserForMemberParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return replaceUserForMember;
  };

  addCaregiver = async ({
    addCaregiverParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    addCaregiverParams: AddCaregiverParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Caregiver> => {
    const { addCaregiver } = await this.client
      .request(
        gql`
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
        { addCaregiverParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return addCaregiver;
  };

  dismissAlert = async ({
    alertId,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    alertId: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { dismissAlert } = await this.client
      .request(
        gql`
          mutation dismissAlert($alertId: String!) {
            dismissAlert(alertId: $alertId)
          }
        `,
        { alertId },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return dismissAlert;
  };

  setLastQueryAlert = async ({
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { setLastQueryAlert } = await this.client
      .request(
        gql`
          mutation setLastQueryAlert {
            setLastQueryAlert
          }
        `,
        undefined,
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return setLastQueryAlert;
  };

  updateCaregiver = async ({
    updateCaregiverParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    updateCaregiverParams: UpdateCaregiverParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<Caregiver> => {
    const { updateCaregiver } = await this.client
      .request(
        gql`
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
        { updateCaregiverParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateCaregiver;
  };

  deleteCaregiver = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id: string;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { deleteCaregiver } = await this.client
      .request(
        gql`
          mutation deleteCaregiver($id: String!) {
            deleteCaregiver(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteCaregiver;
  };

  completeMultipartUpload = async ({
    completeMultipartUploadParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    completeMultipartUploadParams?: CompleteMultipartUploadParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<string> => {
    const { completeMultipartUpload } = await this.client
      .request(
        gql`
          mutation completeMultipartUpload(
            $completeMultipartUploadParams: CompleteMultipartUploadParams!
          ) {
            completeMultipartUpload(completeMultipartUploadParams: $completeMultipartUploadParams)
          }
        `,
        { completeMultipartUploadParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          invalidFieldsErrors,
          missingFieldError,
        });
      });

    return completeMultipartUpload;
  };

  createTodo = async ({
    createTodoParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createTodoParams: CreateTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createTodo } = await this.client
      .request(
        gql`
          mutation createTodo($createTodoParams: CreateTodoParams!) {
            createTodo(createTodoParams: $createTodoParams) {
              id
            }
          }
        `,
        { createTodoParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createTodo;
  };

  endAndCreateTodo = async ({
    endAndCreateTodoParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    endAndCreateTodoParams: EndAndCreateTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Todo> => {
    const { endAndCreateTodo } = await this.client
      .request(
        gql`
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
              relatedTo
              createdBy
              updatedBy
            }
          }
        `,
        { endAndCreateTodoParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return endAndCreateTodo;
  };

  endTodo = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { endTodo } = await this.client
      .request(
        gql`
          mutation endTodo($id: String!) {
            endTodo(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return endTodo;
  };

  approveTodo = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { approveTodo } = await this.client
      .request(
        gql`
          mutation approveTodo($id: String!) {
            approveTodo(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return approveTodo;
  };

  createTodoDone = async ({
    createTodoDoneParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createTodoDoneParams: CreateTodoDoneParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createTodoDone } = await this.client
      .request(
        gql`
          mutation createTodoDone($createTodoDoneParams: CreateTodoDoneParams!) {
            createTodoDone(createTodoDoneParams: $createTodoDoneParams) {
              id
            }
          }
        `,
        { createTodoDoneParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createTodoDone;
  };

  deleteTodoDone = async ({
    id,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    id;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }): Promise<boolean> => {
    const { deleteTodoDone } = await this.client
      .request(
        gql`
          mutation deleteTodoDone($id: String!) {
            deleteTodoDone(id: $id)
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return deleteTodoDone;
  };

  createCarePlan = async ({
    createCarePlanParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createCarePlanParams: CreateCarePlanParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createCarePlan } = await this.client
      .request(
        gql`
          mutation createCarePlan($createCarePlanParams: CreateCarePlanParams!) {
            createCarePlan(createCarePlanParams: $createCarePlanParams) {
              id
            }
          }
        `,
        { createCarePlanParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createCarePlan;
  };

  updateCarePlan = async ({
    updateCarePlanParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateCarePlanParams: UpdateCarePlanParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { updateCarePlan } = await this.client
      .request(
        gql`
          mutation updateCarePlan($updateCarePlanParams: UpdateCarePlanParams!) {
            updateCarePlan(updateCarePlanParams: $updateCarePlanParams) {
              id
            }
          }
        `,
        { updateCarePlanParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateCarePlan;
  };

  createQuestionnaire = async ({
    createQuestionnaireParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    createQuestionnaireParams: CreateQuestionnaireParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Identifier> => {
    const { createQuestionnaire } = await this.client
      .request(
        gql`
          mutation createQuestionnaire($createQuestionnaireParams: CreateQuestionnaireParams!) {
            createQuestionnaire(createQuestionnaireParams: $createQuestionnaireParams) {
              id
            }
          }
        `,
        { createQuestionnaireParams },
        this.defaultAdminRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createQuestionnaire;
  };

  submitQuestionnaireResponse = async ({
    submitQuestionnaireResponseParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<QuestionnaireResponse> => {
    const { submitQuestionnaireResponse } = await this.client
      .request(
        gql`
          mutation submitQuestionnaireResponse(
            $submitQuestionnaireResponseParams: SubmitQuestionnaireResponseParams!
          ) {
            submitQuestionnaireResponse(
              submitQuestionnaireResponseParams: $submitQuestionnaireResponseParams
            ) {
              id
            }
          }
        `,
        { submitQuestionnaireResponseParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return submitQuestionnaireResponse;
  };

  submitCareWizard = async ({
    submitCareWizardParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    submitCareWizardParams: SubmitCareWizardParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifiers> => {
    const { submitCareWizard } = await this.client
      .request(
        gql`
          mutation submitCareWizard($submitCareWizardParams: SubmitCareWizardParams!) {
            submitCareWizard(submitCareWizardParams: $submitCareWizardParams) {
              ids
            }
          }
        `,
        { submitCareWizardParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return submitCareWizard;
  };

  updateBarrier = async ({
    updateBarrierParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateBarrierParams: UpdateBarrierParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { updateBarrier } = await this.client
      .request(
        gql`
          mutation updateBarrier($updateBarrierParams: UpdateBarrierParams!) {
            updateBarrier(updateBarrierParams: $updateBarrierParams) {
              id
            }
          }
        `,
        { updateBarrierParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateBarrier;
  };

  updateRedFlag = async ({
    updateRedFlagParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateRedFlagParams: UpdateRedFlagParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<RedFlag> => {
    const { updateRedFlag } = await this.client
      .request(
        gql`
          mutation updateRedFlag($updateRedFlagParams: UpdateRedFlagParams!) {
            updateRedFlag(updateRedFlagParams: $updateRedFlagParams) {
              id
              notes
              type
            }
          }
        `,
        { updateRedFlagParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateRedFlag;
  };
}
