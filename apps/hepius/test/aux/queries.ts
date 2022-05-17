import { Barrier, BarrierType, CarePlan, CarePlanType, Caregiver } from '@argus/hepiusClient';
import { GraphQLClient } from 'graphql-request';
import gql from 'graphql-tag';
import { isResultValid } from '..';
import { RedFlag, RedFlagType } from '../../src/care';
import { GetCommunicationParams } from '../../src/communication';
import { DailyReportQueryInput } from '../../src/dailyReport';
import {
  Admission,
  DietaryMatcher,
  DischargeDocumentsLinks,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  Journey,
  Member,
  MultipartUploadInfo,
  MultipartUploadRecordingLinkParams,
  RecordingLinkParams,
} from '../../src/member';
import { Questionnaire, QuestionnaireResponse } from '../../src/questionnaire';
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

  getUserSlots = async (getSlotsParams: GetSlotsParams, invalidFieldsError?: string) => {
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
          return;
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        return;
      });

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
        return;
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
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
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
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
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
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
        });
      });

    return getMemberDownloadRecordingLink;
  };

  getMembers = async ({
    orgId,
    requestHeaders = this.defaultUserRequestHeaders,
  }: {
    orgId?: string;
    requestHeaders?;
  }): Promise<{ errors?; members? }> => {
    let errorsObject = {};
    const result = await this.client
      .request(
        gql`
          query getMembers($orgId: String) {
            getMembers(orgId: $orgId) {
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
        { orgId },
        requestHeaders,
      )
      .catch((ex) => {
        errorsObject = { errors: ex.response.errors };
      });

    const resultObject = result ? { members: result.getMembers } : {};
    return { ...resultObject, ...errorsObject };
  };

  getMembersAppointments = async (orgId?: string, invalidFieldsError?: string) => {
    const result = await this.client
      .request(
        gql`
          query getMembersAppointments($orgId: String) {
            getMembersAppointments(orgId: $orgId) {
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
        { orgId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        return;
      });
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        return;
      });
    return result?.getAppointment;
  };

  getAvailabilities = async ({ requestHeaders }: { requestHeaders }) => {
    const { getAvailabilities } = await this.client.request(
      gql`
        query getAvailabilities {
          getAvailabilities {
            id
            start
            end
            userId
            userName
          }
        }
      `,
      undefined,
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
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
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
      .catch((ex) => {
        expect(invalidFieldsError).toEqual(ex.response.errors[0].message);
        return;
      });

    return result?.getMemberConfig;
  };

  getUserConfig = async ({
    id,
    invalidFieldsError,
  }: {
    id: string;
    invalidFieldsError?: string;
  }) => {
    const result = await this.client
      .request(
        gql`
          query getUserConfig($id: String!) {
            getUserConfig(id: $id) {
              userId
              accessToken
            }
          }
        `,
        { id },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
      });

    return result?.getUserConfig;
  };

  getOrg = async ({ id }: { id: string }) => {
    const { getOrg } = await this.client.request(
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
      this.defaultUserRequestHeaders,
    );

    return getOrg;
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
              deletedMedia
            }
          }
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
            }
          }
        `,
        { id },
        requestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
        return isResultValid({
          errors: ex.response.errors,
          missingFieldError,
          invalidFieldsErrors,
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

    return result?.getMemberUploadJournalAudioLink;
  };

  getDailyReports = async ({
    dailyReportQueryInput,
  }: {
    dailyReportQueryInput: DailyReportQueryInput;
  }) => {
    const { getDailyReports } = await this.client.request(
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
    );

    return getDailyReports;
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
        return;
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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
            }
          }
        `,
        { memberId },
        requestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toContain(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

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
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

    return result?.getJourney;
  };

  getActiveJourney = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<Journey> => {
    const result = await this.client
      .request(
        gql`
          query getActiveJourney($memberId: String!) {
            getActiveJourney(memberId: $memberId) {
              ...journeyFragment
            }
          }
          ${FRAGMENT_JOURNEY}
        `,
        { memberId },
        this.defaultUserRequestHeaders,
      )
      .catch((ex) => {
        expect(ex.response.errors[0].message).toMatch(invalidFieldsError);
        return;
      });

    return result?.getActiveJourney;
  };
}
