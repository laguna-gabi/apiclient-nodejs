import {
  Barrier,
  BarrierType,
  CarePlan,
  CarePlanType,
  Caregiver,
  ClientInfo,
} from '@argus/hepiusClient';
import { GraphQLClient } from 'graphql-request';
import gql from 'graphql-tag';
import { generateGetSlotsParams, handleExceptionReceived } from '..';
import { RedFlag, RedFlagType } from '../../src/care';
import { GetCommunicationParams } from '../../src/communication';
import { DailyReportQueryInput } from '../../src/dailyReport';
import {
  ActionItem,
  ActionItemByPrimaryUser,
  Admission,
  DietaryMatcher,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  Journey,
} from '../../src/journey';
import { DischargeDocumentsLinks, Member } from '../../src/member';
import { Questionnaire, QuestionnaireResponse } from '../../src/questionnaire';
import {
  MultipartUploadInfo,
  MultipartUploadRecordingLinkParams,
  RecordingLinkParams,
} from '../../src/recording';
import { Dispatch } from '../../src/services';
import { GetTodoDonesParams, Todo, TodoDone } from '../../src/todo';
import { GetSlotsParams, UserSummary } from '../../src/user';
import { FRAGMENT_ADMISSION, FRAGMENT_JOURNEY, FRAGMENT_MEMBER } from './fragments';

export class Queries {
  constructor(private readonly client: GraphQLClient, private readonly defaultUserRequestHeaders) {}

  getUser = async ({
    requestHeaders = this.defaultUserRequestHeaders,
  }: { requestHeaders? } = {}) => {
    const { getUser } = await this.client.request(
      gql`
        query getUser {
          getUser {
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
            lastQueryAlert
            orgs
            appointments {
              id
              notBefore
              method
              status
              start
              end
            }
          }
        }
      `,
      undefined,
      requestHeaders,
    );

    return getUser;
  };

  getUsers = async (
    { requestHeaders = this.defaultUserRequestHeaders }: { requestHeaders? } = {
      requestHeaders: this.defaultUserRequestHeaders,
    },
  ): Promise<UserSummary[]> => {
    const { getUsers } = await this.client.request(
      gql`
        query getUsers {
          getUsers {
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
            currentMembersCount
            languages
            orgs
            appointments {
              id
              notBefore
              method
              status
              start
              end
            }
          }
        }
      `,
      undefined,
      requestHeaders,
    );

    return getUsers;
  };

  getUserSlots = async (
    {
      getSlotsParams,
      invalidFieldsError,
      requestHeaders = this.defaultUserRequestHeaders,
    }: { getSlotsParams: GetSlotsParams; invalidFieldsError?: string; requestHeaders? } = {
      getSlotsParams: generateGetSlotsParams(),
      requestHeaders: this.defaultUserRequestHeaders,
    },
  ) => {
    const result = await this.client
      .request(
        gql`
          query getUserSlots($getSlotsParams: GetSlotsParams!) {
            getUserSlots(getSlotsParams: $getSlotsParams) {
              slots
              user {
                id
                firstName
                roles
                avatar
                description
              }
              member {
                id
                firstName
              }
              appointment {
                id
                start
                method
                duration
              }
            }
          }
        `,
        { getSlotsParams },
        requestHeaders,
      )
      .catch((ex) => {
        if (invalidFieldsError) {
          expect(ex.response.errors[0]?.message || ex.response.errors[0][0]?.message).toContain(
            invalidFieldsError,
          );
        }
      });

    return result?.getUserSlots;
  };

  getUserSlotsByAppointmentId = async (
    appointmentId,
    requestHeaders,
    invalidFieldsError?: string,
  ) => {
    const result = await this.client
      .request(
        gql`
          query getUserSlotsByAppointmentId($appointmentId: String!) {
            getUserSlotsByAppointmentId(appointmentId: $appointmentId) {
              slots
              user {
                id
                firstName
                roles
                avatar
                description
              }
              member {
                id
                firstName
              }
              appointment {
                id
                start
                method
                duration
              }
            }
          }
        `,
        { appointmentId },
        requestHeaders,
      )
      .catch((ex) => {
        if (invalidFieldsError) {
          expect(ex.response.errors[0]?.message || ex.response.errors[0][0]?.message).toContain(
            invalidFieldsError,
          );
        }
      });

    return result?.getUserSlotsByAppointmentId;
  };

  getMember = async ({
    id,
    requestHeaders = this.defaultUserRequestHeaders,
    invalidFieldsError,
  }: { id?: string; requestHeaders?; invalidFieldsError? } = {}): Promise<Member> => {
    const result = await this.client
      .request(
        gql`
          query getMember($id: String) {
            getMember(id: $id) {
              ...memberFragment
            }
          }
          ${FRAGMENT_MEMBER}
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMember;
  };

  getMemberUploadDischargeDocumentsLinks = async ({
    id,
    invalidFieldsError,
    missingFieldError,
  }: {
    id?: string;
    invalidFieldsError?: string;
    missingFieldError?: string;
  } = {}): Promise<DischargeDocumentsLinks> => {
    const result = await this.client
      .request(
        gql`
          query getMemberUploadDischargeDocumentsLinks($id: String!) {
            getMemberUploadDischargeDocumentsLinks(id: $id) {
              dischargeNotesLink
              dischargeInstructionsLink
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        if (invalidFieldsError) {
          expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        } else if (missingFieldError) {
          expect(ex.response.errors[0].message).toMatch(missingFieldError);
        }
      });

    return result?.getMemberUploadDischargeDocumentsLinks;
  };

  getMemberDownloadDischargeDocumentsLinks = async ({
    id,
    invalidFieldsError,
    missingFieldError,
  }: {
    id?: string;
    invalidFieldsError?: string;
    missingFieldError?: string;
  } = {}): Promise<DischargeDocumentsLinks> => {
    const result = await this.client
      .request(
        gql`
          query getMemberDownloadDischargeDocumentsLinks($id: String) {
            getMemberDownloadDischargeDocumentsLinks(id: $id) {
              dischargeNotesLink
              dischargeInstructionsLink
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        if (invalidFieldsError) {
          expect(invalidFieldsError).toEqual(ex.response.errors[0].message);
        } else if (missingFieldError) {
          expect(ex.response.errors[0].message).toMatch(missingFieldError);
        }
      });

    return result?.getMemberDownloadDischargeDocumentsLinks;
  };

  getMemberUploadRecordingLink = async ({
    recordingLinkParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    recordingLinkParams?: RecordingLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  } = {}): Promise<string> => {
    const { getMemberUploadRecordingLink } = await this.client
      .request(
        gql`
          query getMemberUploadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
            getMemberUploadRecordingLink(recordingLinkParams: $recordingLinkParams)
          }
        `,
        { recordingLinkParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return handleExceptionReceived({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
          params: recordingLinkParams,
        });
      });

    return getMemberUploadRecordingLink;
  };

  getMemberMultipartUploadRecordingLink = async ({
    multipartUploadRecordingLinkParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    multipartUploadRecordingLinkParams?: MultipartUploadRecordingLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  } = {}): Promise<MultipartUploadInfo> => {
    const { getMemberMultipartUploadRecordingLink } = await this.client
      .request(
        gql`
          query getMemberMultipartUploadRecordingLink(
            $multipartUploadRecordingLinkParams: MultipartUploadRecordingLinkParams!
          ) {
            getMemberMultipartUploadRecordingLink(
              multipartUploadRecordingLinkParams: $multipartUploadRecordingLinkParams
            ) {
              url
              uploadId
            }
          }
        `,
        { multipartUploadRecordingLinkParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return handleExceptionReceived({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
          params: multipartUploadRecordingLinkParams,
        });
      });

    return getMemberMultipartUploadRecordingLink;
  };

  getMemberDownloadRecordingLink = async ({
    recordingLinkParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    recordingLinkParams?: RecordingLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  } = {}): Promise<string> => {
    const { getMemberDownloadRecordingLink } = await this.client
      .request(
        gql`
          query getMemberDownloadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
            getMemberDownloadRecordingLink(recordingLinkParams: $recordingLinkParams)
          }
        `,
        { recordingLinkParams },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        return handleExceptionReceived({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
          params: recordingLinkParams,
        });
      });

    return getMemberDownloadRecordingLink;
  };

  getMembers = async ({
    orgIds,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    orgIds?: string[];
    requestHeaders?;
  }): Promise<{ errors?; members? }> => {
    let errorsObject = {};
    const result = await this.client
      .request(
        gql`
          query getMembers($orgIds: [String!]) {
            getMembers(orgIds: $orgIds) {
              id
              name
              phone
              phoneType
              dischargeDate
              adherence
              wellbeing
              createdAt
              actionItemsCount
              primaryUser {
                id
                firstName
                lastName
                avatar
                createdAt
              }
              nextAppointment
              appointmentsCount
              firstLoggedInAt
              platform
              isGraduated
              graduationDate
            }
          }
        `,
        { orgIds },
        requestHeaders,
      )
      .catch((ex) => {
        errorsObject = { errors: ex.response.errors };
      });

    const resultObject = result ? { members: result.getMembers } : {};
    return { ...resultObject, ...errorsObject };
  };

  getActionItemsOfPrimaryUser = async ({
    requestHeaders,
  }: {
    requestHeaders;
  }): Promise<ActionItemByPrimaryUser[]> => {
    const result = await this.client.request(
      gql`
        query getActionItemsOfPrimaryUser {
          getActionItemsOfPrimaryUser {
            id
            memberId
            appointmentId
            journeyId
            title
            status
            deadline
            rejectNote
            description
            category
            priority
            createdAt
            createdBy
            relatedEntities {
              type
              id
            }
            memberName
          }
        }
      `,
      undefined,
      requestHeaders,
    );
    return result?.getActionItemsOfPrimaryUser;
  };

  getMembersAppointments = async ({
    orgIds,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    orgIds?: string[];
    invalidFieldsError?: string;
    requestHeaders?;
  } = {}) => {
    const result = await this.client
      .request(
        gql`
          query getMembersAppointments($orgIds: [String!]) {
            getMembersAppointments(orgIds: $orgIds) {
              memberId
              memberName
              userId
              userName
              start
              end
              status
            }
          }
        `,
        { orgIds },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));
    return result?.getMembersAppointments;
  };

  getAppointment = async ({
    id,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    id: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getAppointment($id: String!) {
            getAppointment(id: $id) {
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
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));
    return result?.getAppointment;
  };

  getAvailabilities = async ({ orgIds, requestHeaders }: { orgIds?: string[]; requestHeaders }) => {
    const { getAvailabilities } = await this.client.request(
      gql`
        query getAvailabilities($orgIds: [String!]) {
          getAvailabilities(orgIds: $orgIds) {
            id
            start
            end
            userId
            userName
          }
        }
      `,
      { orgIds },
      requestHeaders,
    );

    return getAvailabilities;
  };

  getCommunication = async ({
    getCommunicationParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    getCommunicationParams: GetCommunicationParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders?;
  }) => {
    const { getCommunication } = await this.client
      .request(
        gql`
          query getCommunication($getCommunicationParams: GetCommunicationParams!) {
            getCommunication(getCommunicationParams: $getCommunicationParams) {
              memberId
              userId
              chat {
                memberLink
                userLink
              }
            }
          }
        `,
        { getCommunicationParams },
        requestHeaders,
      )
      .catch((ex) => {
        return handleExceptionReceived({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
          params: getCommunicationParams,
        });
      });

    return getCommunication;
  };

  getMemberConfig = async ({
    id,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    id?: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getMemberConfig($id: String) {
            getMemberConfig(id: $id) {
              memberId
              externalUserId
              platform
              isPushNotificationsEnabled
              isAppointmentsReminderEnabled
              isRecommendationsEnabled
              isTodoNotificationsEnabled
              articlesPath
              firstLoggedInAt
              lastLoggedInAt
              language
              systemVersion
              brand
              codePushVersion
              appVersion
              buildVersion
            }
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberConfig;
  };

  getUserConfig = async ({ invalidFieldsError }: { invalidFieldsError?: string }) => {
    const result = await this.client
      .request(
        gql`
          query getUserConfig {
            getUserConfig {
              userId
              accessToken
            }
          }
        `,
        {},
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
      });

    return result?.getUserConfig;
  };

  getOrg = async ({
    id,
    requestHeaders = this.defaultUserRequestHeaders,
    invalidFieldsError,
  }: {
    id: string;
    requestHeaders?;
    invalidFieldsError?: string;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getOrg($id: String!) {
            getOrg(id: $id) {
              id
              name
              type
              zipCode
              trialDuration
              code
            }
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
      });

    return result?.getOrg;
  };

  getOrgs = async ({
    invalidFieldsError,
    requestHeaders,
  }: {
    invalidFieldsError?: string;
    requestHeaders;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getOrgs {
            getOrgs {
              id
              name
              type
              zipCode
              trialDuration
              code
            }
          }
        `,
        {},
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getOrgs;
  };

  getRecordings = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getRecordings($memberId: String!) {
            getRecordings(memberId: $memberId) {
              id
              userId
              start
              end
              answered
              phone
              recordingType
              consent
              identityVerification
            }
          }
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getRecordings;
  };

  getJournal = async ({
    id,
    invalidFieldsError,
    requestHeaders,
  }: {
    id;
    invalidFieldsError?: string;
    requestHeaders;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getJournal($id: String!) {
            getJournal(id: $id) {
              id
              memberId
              text
              published
              updatedAt
              createdAt
            }
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getJournal;
  };

  getJournals = async ({ requestHeaders }: { requestHeaders }) => {
    const result = await this.client
      .request(
        gql`
          query getJournals {
            getJournals {
              id
              memberId
              text
              published
              updatedAt
              createdAt
            }
          }
        `,
        undefined,
        requestHeaders,
      )
      .catch();

    return result?.getJournals;
  };

  getMemberUploadJournalImageLink = async ({
    getMemberUploadJournalImageLinkParams,
    missingFieldError,
    invalidFieldsErrors,
    requestHeaders,
  }: {
    getMemberUploadJournalImageLinkParams: GetMemberUploadJournalImageLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
    requestHeaders;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getMemberUploadJournalImageLink(
            $getMemberUploadJournalImageLinkParams: GetMemberUploadJournalImageLinkParams!
          ) {
            getMemberUploadJournalImageLink(
              getMemberUploadJournalImageLinkParams: $getMemberUploadJournalImageLinkParams
            ) {
              normalImageLink
            }
          }
        `,
        { getMemberUploadJournalImageLinkParams },
        requestHeaders,
      )
      .catch((ex) => {
        return handleExceptionReceived({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
          params: getMemberUploadJournalImageLinkParams,
        });
      });

    return result?.getMemberUploadJournalImageLink;
  };

  getMemberUploadJournalAudioLink = async ({
    getMemberUploadJournalAudioLinkParams,
    invalidFieldsError,
    requestHeaders,
  }: {
    getMemberUploadJournalAudioLinkParams: GetMemberUploadJournalAudioLinkParams;
    invalidFieldsError?: string;
    requestHeaders;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getMemberUploadJournalAudioLink(
            $getMemberUploadJournalAudioLinkParams: GetMemberUploadJournalAudioLinkParams!
          ) {
            getMemberUploadJournalAudioLink(
              getMemberUploadJournalAudioLinkParams: $getMemberUploadJournalAudioLinkParams
            ) {
              audioLink
            }
          }
        `,
        { getMemberUploadJournalAudioLinkParams },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberUploadJournalAudioLink;
  };

  getDailyReports = async ({
    dailyReportQueryInput,
    invalidFieldsError,
  }: {
    dailyReportQueryInput: DailyReportQueryInput;
    invalidFieldsError?: string;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getDailyReports($dailyReportQueryInput: DailyReportQueryInput!) {
            getDailyReports(dailyReportQueryInput: $dailyReportQueryInput) {
              data {
                memberId
                date
                categories {
                  rank
                  category
                }
                statsOverThreshold
              }
              metadata {
                minDate
              }
            }
          }
        `,
        { dailyReportQueryInput },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getDailyReports;
  };

  getCaregivers = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }): Promise<Caregiver[]> => {
    const result = await this.client
      .request(
        gql`
          query getCaregivers($memberId: String) {
            getCaregivers(memberId: $memberId) {
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
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getCaregivers;
  };

  getAlerts = async ({ requestHeaders }: { requestHeaders }): Promise<Dispatch[]> => {
    const { getAlerts } = await this.client.request(
      gql`
        query getAlerts {
          getAlerts {
            id
            type
            date
            dismissed
            isNew
            memberId
            text
          }
        }
      `,
      undefined,
      requestHeaders,
    );
    return getAlerts;
  };

  getTodos = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId?;
    invalidFieldsError?: string;
    requestHeaders?;
  } = {}): Promise<Todo[]> => {
    const result = await this.client
      .request(
        gql`
          query getTodos($memberId: String) {
            getTodos(memberId: $memberId) {
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
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getTodos;
  };

  getTodoDones = async ({
    getTodoDonesParams,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    getTodoDonesParams?: GetTodoDonesParams;
    invalidFieldsError?: string;
    requestHeaders?;
  } = {}): Promise<TodoDone[]> => {
    const result = await this.client
      .request(
        gql`
          query getTodoDones($getTodoDonesParams: GetTodoDonesParams!) {
            getTodoDones(getTodoDonesParams: $getTodoDonesParams) {
              id
              memberId
              todoId
              done
            }
          }
        `,
        { getTodoDonesParams },
        requestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message || ex.response.errors[0][0].message).toMatch(
          invalidFieldsError,
        );
      });

    return result?.getTodoDones;
  };

  getMemberRedFlags = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }): Promise<RedFlag[]> => {
    const result = await this.client
      .request(
        gql`
          query getMemberRedFlags($memberId: String!) {
            getMemberRedFlags(memberId: $memberId) {
              id
              memberId
              createdBy
              type {
                id
                description
              }
              notes
              createdBy
            }
          }
        `,
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberRedFlags;
  };

  getMemberCarePlans = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }): Promise<CarePlan[]> => {
    const result = await this.client
      .request(
        gql`
          query getMemberCarePlans($memberId: String!) {
            getMemberCarePlans(memberId: $memberId) {
              id
              memberId
              createdBy
              barrierId
              status
              type {
                id
                description
                isCustom
              }
              notes
              createdBy
              dueDate
              completionNote
            }
          }
        `,
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberCarePlans;
  };

  getActiveQuestionnaires = async (): Promise<Questionnaire[]> => {
    const { getActiveQuestionnaires } = await this.client.request(
      gql`
        query getActiveQuestionnaires {
          getActiveQuestionnaires {
            id
            name
            type
            active
            items {
              label
              code
              type
              order
              options {
                label
                value
              }
              items {
                label
                code
                type
                order
                options {
                  label
                  value
                }
              }
            }
            isAssignableToMember
            createdBy
          }
        }
      `,
      undefined,
      this.defaultUserRequestHeaders,
    );

    return getActiveQuestionnaires;
  };

  getQuestionnaire = async ({
    id,
    invalidFieldsError,
  }: {
    id;
    invalidFieldsError?: string;
  }): Promise<Questionnaire> => {
    const result = await this.client
      .request(
        gql`
          query getQuestionnaire($id: String!) {
            getQuestionnaire(id: $id) {
              id
              shortName
              items {
                code
                label
                items {
                  code
                  label
                }
              }
              severityLevels {
                label
                min
                max
              }
              isAssignableToMember
              createdBy
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getQuestionnaire;
  };

  getQuestionnaireResponse = async ({
    id,
    invalidFieldsError,
  }: {
    id;
    invalidFieldsError?: string;
  }): Promise<QuestionnaireResponse> => {
    const result = await this.client
      .request(
        gql`
          query getQuestionnaireResponse($id: String!) {
            getQuestionnaireResponse(id: $id) {
              id
              type
              answers {
                code
                value
              }
              result {
                alert
                score
                severity
              }
              createdAt
              createdBy
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getQuestionnaireResponse;
  };

  getMemberQuestionnaireResponses = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId;
    invalidFieldsError?: string;
  }): Promise<QuestionnaireResponse[]> => {
    const result = await this.client
      .request(
        gql`
          query getMemberQuestionnaireResponses($memberId: String!) {
            getMemberQuestionnaireResponses(memberId: $memberId) {
              id
              type
              answers {
                code
                value
              }
              result {
                alert
                score
                severity
              }
              createdAt
              createdBy
            }
          }
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberQuestionnaireResponses;
  };

  getCarePlanTypes = async (): Promise<CarePlanType[]> => {
    const { getCarePlanTypes } = await this.client.request(
      gql`
        query getCarePlanTypes {
          getCarePlanTypes {
            id
            description
            isCustom
          }
        }
      `,
      undefined,
      this.defaultUserRequestHeaders,
    );

    return getCarePlanTypes;
  };

  getBarrierTypes = async (): Promise<BarrierType[]> => {
    const { getBarrierTypes } = await this.client.request(
      gql`
        query getBarrierTypes {
          getBarrierTypes {
            id
            description
            domain
            carePlanTypes {
              id
              description
              isCustom
            }
          }
        }
      `,
      undefined,
      this.defaultUserRequestHeaders,
    );

    return getBarrierTypes;
  };

  getMemberBarriers = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }): Promise<Barrier[]> => {
    const result = await this.client
      .request(
        gql`
          query getMemberBarriers($memberId: String!) {
            getMemberBarriers(memberId: $memberId) {
              id
              memberId
              createdBy
              redFlagId
              status
              type {
                id
                description
                domain
              }
              notes
              createdBy
            }
          }
        `,
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberBarriers;
  };

  getRedFlagTypes = async (): Promise<RedFlagType[]> => {
    const { getRedFlagTypes } = await this.client.request(
      gql`
        query getRedFlagTypes {
          getRedFlagTypes {
            id
            description
          }
        }
      `,
      undefined,
      this.defaultUserRequestHeaders,
    );

    return getRedFlagTypes;
  };

  getMemberAdmissions = async ({
    memberId,
    invalidFieldsError,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    memberId: string;
    invalidFieldsError?: string;
    requestHeaders?;
  }): Promise<Admission[]> => {
    const result = await this.client
      .request(
        gql`
          query getMemberAdmissions($memberId: String!) {
            getMemberAdmissions(memberId: $memberId) {
              ...admissionFragment
            }
          }
          ${FRAGMENT_ADMISSION}
        `,
        { memberId },
        requestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getMemberAdmissions;
  };

  getAdmissionsDietaryMatcher = async (): Promise<DietaryMatcher> => {
    const { getAdmissionsDietaryMatcher } = await this.client.request(
      gql`
        query getAdmissionsDietaryMatcher {
          getAdmissionsDietaryMatcher {
            map {
              key
              values
            }
          }
        }
      `,
      undefined,
      this.defaultUserRequestHeaders,
    );

    return getAdmissionsDietaryMatcher;
  };

  getJourneys = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<Journey[]> => {
    const result = await this.client
      .request(
        gql`
          query getJourneys($memberId: String!) {
            getJourneys(memberId: $memberId) {
              ...journeyFragment
            }
          }
          ${FRAGMENT_JOURNEY}
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getJourneys;
  };

  getJourney = async ({
    id,
    invalidFieldsError,
  }: {
    id: string;
    invalidFieldsError?: string;
  }): Promise<Journey> => {
    const result = await this.client
      .request(
        gql`
          query getJourney($id: String!) {
            getJourney(id: $id) {
              ...journeyFragment
            }
          }
          ${FRAGMENT_JOURNEY}
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getJourney;
  };

  getRecentJourney = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<Journey> => {
    const result = await this.client
      .request(
        gql`
          query getRecentJourney($memberId: String!) {
            getRecentJourney(memberId: $memberId) {
              ...journeyFragment
            }
          }
          ${FRAGMENT_JOURNEY}
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getRecentJourney;
  };

  getActionItems = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<ActionItem[]> => {
    const result = await this.client
      .request(
        gql`
          query getActionItems($memberId: String!) {
            getActionItems(memberId: $memberId) {
              id
              memberId
              appointmentId
              journeyId
              title
              status
              deadline
              rejectNote
              description
              category
              priority
              createdAt
              createdBy
              relatedEntities {
                type
                id
              }
            }
          }
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return result?.getActionItems;
  };

  getClient = async ({
    id,
    invalidFieldsError,
  }: {
    id: string;
    invalidFieldsError?: string;
  }): Promise<ClientInfo> => {
    const { getClient } = await this.client
      .request(
        gql`
          query getClient($id: String!) {
            getClient(id: $id) {
              id
              firstName
              lastName
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => expect(ex.response.errors[0].message).toContain(invalidFieldsError));

    return getClient;
  };
}
