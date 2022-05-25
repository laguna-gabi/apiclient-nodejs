import {
  Appointment,
  Caregiver,
  CreateCarePlanParams,
  Identifier,
  Notes,
  User,
} from '@argus/hepiusClient';
import { GraphQLClient } from 'graphql-request';
import gql from 'graphql-tag';
import { camelCase } from 'lodash';
import { isResultValid } from '..';
import {
  EndAppointmentParams,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
  UpdateNotesParams,
} from '../../src/appointment';
import { AvailabilityInput } from '../../src/availability';
import {
  CreateBarrierParams,
  DeleteCarePlanParams,
  RedFlag,
  UpdateBarrierParams,
  UpdateCarePlanParams,
  UpdateRedFlagParams,
} from '../../src/care';
import { SubmitCareWizardParams } from '../../src/care/wizard.dto';
import { Identifiers, RegisterForNotificationParams } from '../../src/common';
import { DailyReportCategoriesInput } from '../../src/dailyReport';
import {
  AddCaregiverParams,
  CancelNotifyParams,
  CompleteMultipartUploadParams,
  CreateMemberParams,
  DeleteDischargeDocumentParams,
  DeleteMemberParams,
  Journal,
  Member,
  NotifyContentParams,
  NotifyParams,
  Recording,
  ReplaceMemberOrgParams,
  ReplaceUserForMemberParams,
  UpdateCaregiverParams,
  UpdateJournalTextParams,
  UpdateMemberConfigParams,
  UpdateMemberParams,
  UpdateRecordingParams,
} from '../../src/member';
import {
  Admission,
  ChangeMemberDnaParams,
  CreateActionItemParams,
  GraduateMemberParams,
  SetGeneralNotesParams,
  UpdateActionItemStatusParams,
  UpdateJourneyParams,
} from '../../src/journey';

import { CreateOrgParams } from '../../src/org';
import {
  CreateQuestionnaireParams,
  QuestionnaireResponse,
  SubmitQuestionnaireResponseParams,
} from '../../src/questionnaire';
import {
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  Todo,
  UpdateTodoParams,
} from '../../src/todo';
import { CreateUserParams, UpdateUserParams } from '../../src/user';
import {
  FRAGMENT_ADMISSION,
  FRAGMENT_APPOINTMENT,
  FRAGMENT_JOURNEY,
  FRAGMENT_MEMBER,
} from './fragments';

export class Mutations {
  constructor(
    private readonly client: GraphQLClient,
    private readonly defaultUserRequestHeaders,
    private readonly defaultAdminRequestHeaders,
  ) {}

  createUser = async ({
    createUserParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createUserParams: CreateUserParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<User> => {
    const { createUser } = await this.client
      .request(
        gql`
          mutation CreateUser($createUserParams: CreateUserParams!) {
            createUser(createUserParams: $createUserParams) {
              id
              authId
              username
            }
          }
        `,
        {
          createUserParams: {
            ...createUserParams,
            roles: createUserParams.roles?.map((role) => camelCase(role)),
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

  updateUser = async ({
    updateUserParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateUserParams: UpdateUserParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { updateUser } = await this.client
      .request(
        gql`
          mutation UpdateUser($updateUserParams: UpdateUserParams!) {
            updateUser(updateUserParams: $updateUserParams) {
              id
              authId
              username
              firstName
              lastName
              email
              roles
              avatar
              description
              createdAt
              phone
              title
              maxMembers
              languages
              orgs
            }
          }
        `,
        {
          updateUserParams: {
            ...updateUserParams,
            roles: updateUserParams.roles?.map((role) => camelCase(role)),
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

    return updateUser;
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
              ...memberFragment
            }
          }
          ${FRAGMENT_MEMBER}
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
    createActionItemParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createActionItemParams: CreateActionItemParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createActionItem } = await this.client
      .request(
        gql`
          mutation CreateActionItem($createActionItemParams: CreateActionItemParams!) {
            createActionItem(createActionItemParams: $createActionItemParams) {
              id
            }
          }
        `,
        { createActionItemParams },
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
    updateActionItemStatusParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateActionItemStatusParams: UpdateActionItemStatusParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }) => {
    const { updateActionItemStatus } = await this.client
      .request(
        gql`
          mutation updateActionItemStatus(
            $updateActionItemStatusParams: UpdateActionItemStatusParams!
          ) {
            updateActionItemStatus(updateActionItemStatusParams: $updateActionItemStatusParams)
          }
        `,
        { updateActionItemStatusParams },
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
    invalidFieldsError,
  }: {
    id: string;
    invalidFieldsError?: string;
  }): Promise<Identifiers> => {
    const result = await this.client
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
        if (invalidFieldsError) {
          expect(ex.response.errors[0]?.message || ex.response.errors[0][0]?.message).toContain(
            invalidFieldsError,
          );
          return;
        }
      });

    return result?.deleteAvailability;
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
              consent
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

  replaceMemberOrg = async ({
    replaceMemberOrgParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultAdminRequestHeaders,
  }: {
    replaceMemberOrgParams: ReplaceMemberOrgParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }) => {
    const { replaceMemberOrg } = await this.client
      .request(
        gql`
          mutation replaceMemberOrg($replaceMemberOrgParams: ReplaceMemberOrgParams!) {
            replaceMemberOrg(replaceMemberOrgParams: $replaceMemberOrgParams)
          }
        `,
        { replaceMemberOrgParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return replaceMemberOrg;
  };

  deleteDischargeDocument = async ({
    deleteDischargeDocumentParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    deleteDischargeDocumentParams: DeleteDischargeDocumentParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<boolean> => {
    const result = await this.client
      .request(
        /* eslint-disable max-len */
        gql`
          mutation deleteDischargeDocument(
            $deleteDischargeDocumentParams: DeleteDischargeDocumentParams!
          ) {
            deleteDischargeDocument(deleteDischargeDocumentParams: $deleteDischargeDocumentParams)
          }
        `,
        { deleteDischargeDocumentParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return result;
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
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    completeMultipartUploadParams?: CompleteMultipartUploadParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<boolean> => {
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
        requestHeaders,
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

  createActionTodo = async ({
    createActionTodoParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createActionTodoParams: CreateActionTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createActionTodo } = await this.client
      .request(
        gql`
          mutation createActionTodo($createActionTodoParams: CreateActionTodoParams!) {
            createActionTodo(createActionTodoParams: $createActionTodoParams) {
              id
            }
          }
        `,
        { createActionTodoParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createActionTodo;
  };

  updateTodo = async ({
    updateTodoParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    updateTodoParams: UpdateTodoParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Todo> => {
    const { updateTodo } = await this.client
      .request(
        gql`
          mutation updateTodo($updateTodoParams: UpdateTodoParams!) {
            updateTodo(updateTodoParams: $updateTodoParams) {
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
        { updateTodoParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateTodo;
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
    requestHeaders = this.defaultAdminRequestHeaders,
  }: {
    createQuestionnaireParams: CreateQuestionnaireParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
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
        requestHeaders,
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

  deleteCarePlan = async ({
    deleteCarePlanParams,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    deleteCarePlanParams: DeleteCarePlanParams;
    requestHeaders?;
  }): Promise<boolean> => {
    const { deleteCarePlan } = await this.client.request(
      gql`
        mutation deleteCarePlan($deleteCarePlanParams: DeleteCarePlanParams!) {
          deleteCarePlan(deleteCarePlanParams: $deleteCarePlanParams)
        }
      `,
      { deleteCarePlanParams },
      requestHeaders,
    );

    return deleteCarePlan;
  };

  graduateMember = async ({
    graduateMemberParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    graduateMemberParams: GraduateMemberParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<void> => {
    const requestHeaders = this.defaultAdminRequestHeaders;
    await this.client
      .request(
        gql`
          mutation graduateMember($graduateMemberParams: GraduateMemberParams!) {
            graduateMember(graduateMemberParams: $graduateMemberParams)
          }
        `,
        { graduateMemberParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });
  };

  changeMemberDna = async ({
    changeMemberDnaParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    changeMemberDnaParams: ChangeMemberDnaParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Admission> => {
    const { changeMemberDna } = await this.client
      .request(
        gql`
          mutation changeMemberDna($changeMemberDnaParams: ChangeMemberDnaParams!) {
            changeMemberDna(changeMemberDnaParams: $changeMemberDnaParams) {
              ...admissionFragment
            }
          }
          ${FRAGMENT_ADMISSION}
        `,
        { changeMemberDnaParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return changeMemberDna;
  };

  updateJourney = async ({
    updateJourneyParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    updateJourneyParams: UpdateJourneyParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }): Promise<Member> => {
    const { updateJourney } = await this.client
      .request(
        gql`
          mutation updateJourney($updateJourneyParams: UpdateJourneyParams!) {
            updateJourney(updateJourneyParams: $updateJourneyParams) {
              ...journeyFragment
            }
          }
          ${FRAGMENT_JOURNEY}
        `,
        { updateJourneyParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return updateJourney;
  };

  createBarrier = async ({
    createBarrierParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    createBarrierParams: CreateBarrierParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }): Promise<Identifier> => {
    const { createBarrier } = await this.client
      .request(
        gql`
          mutation createBarrier($createBarrierParams: CreateBarrierParams!) {
            createBarrier(createBarrierParams: $createBarrierParams) {
              id
            }
          }
        `,
        { createBarrierParams },
        requestHeaders,
      )
      .catch((ex) => {
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return createBarrier;
  };
}
