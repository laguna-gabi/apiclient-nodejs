import { ApolloServerTestClient } from 'apollo-server-testing';
import gql from 'graphql-tag';
import { isGQLResultValid as isResultValid } from '../../src/common';
import { GetCommunicationParams } from '../../src/communication';
import { DailyReportQueryInput } from '../../src/dailyReport';
import {
  Caregiver,
  DischargeDocumentsLinks,
  GetMemberUploadJournalAudioLinkParams,
  GetMemberUploadJournalImageLinkParams,
  MultipartUploadRecordingLinkParams,
  RecordingLinkParams,
} from '../../src/member';
import { GetTodoDonesParams, Todo, TodoDone } from '../../src/todo';
import { GetSlotsParams } from '../../src/user';
import { Dispatch } from '../../src/services';
import { BarrierType, CarePlan, CarePlanType, RedFlag } from '../../src/care';
import { Questionnaire, QuestionnaireResponse } from '../../src/questionnaire';

export class Queries {
  constructor(private readonly apolloClient: ApolloServerTestClient) {}

  getUser = async () => {
    const resultGetUser = await this.apolloClient.query({
      query: gql`
        query getUser {
          getUser {
            id
            authId
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
            lastQueryAlert
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
    });

    return resultGetUser.data.getUser;
  };

  getUsers = async () => {
    const resultGetUsers = await this.apolloClient.query({
      query: gql`
        query getUsers {
          getUsers {
            id
            authId
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
            }
          }
        }
      `,
    });

    return resultGetUsers.data.getUsers;
  };

  getUserSlots = async (getSlotsParams: GetSlotsParams, invalidFieldsError?: string) => {
    const resultGetUserSlots = await this.apolloClient.query({
      variables: { getSlotsParams },
      query: gql`
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
    });

    if (invalidFieldsError) {
      expect(
        resultGetUserSlots.errors[0]?.message || resultGetUserSlots.errors[0][0]?.message,
      ).toContain(invalidFieldsError);
      return;
    }

    return resultGetUserSlots.data.getUserSlots;
  };

  getMember = async ({
    id,
    invalidFieldsError,
  }: { id?: string; invalidFieldsError?: string } = {}) => {
    const resultGetMember = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getMember($id: String) {
          getMember(id: $id) {
            id
            phone
            phoneType
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
            phoneSecondaryType
            generalNotes
            nurseNotes
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

    invalidFieldsError && expect(invalidFieldsError).toEqual(resultGetMember.errors[0].message);
    const { errors, data } = resultGetMember || {};

    return { ...data?.getMember, errors };
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
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getMemberUploadDischargeDocumentsLinks($id: String!) {
          getMemberUploadDischargeDocumentsLinks(id: $id) {
            dischargeNotesLink
            dischargeInstructionsLink
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
    } else {
      return result.data.getMemberUploadDischargeDocumentsLinks;
    }
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
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getMemberDownloadDischargeDocumentsLinks($id: String) {
          getMemberDownloadDischargeDocumentsLinks(id: $id) {
            dischargeNotesLink
            dischargeInstructionsLink
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
    } else {
      return result.data.getMemberDownloadDischargeDocumentsLinks;
    }
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
    const result = await this.apolloClient.query({
      variables: { recordingLinkParams },
      query: gql`
        query getMemberUploadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
          getMemberUploadRecordingLink(recordingLinkParams: $recordingLinkParams)
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.getMemberUploadRecordingLink
    );
  };
  getMemberMultipartUploadRecordingLink = async ({
    multipartUploadRecordingLinkParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    multipartUploadRecordingLinkParams?: MultipartUploadRecordingLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  } = {}): Promise<string> => {
    const result = await this.apolloClient.query({
      variables: { multipartUploadRecordingLinkParams },
      query: gql`
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
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.getMemberUploadRecordingLink
    );
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
    const result = await this.apolloClient.query({
      variables: { recordingLinkParams },
      query: gql`
        query getMemberDownloadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
          getMemberDownloadRecordingLink(recordingLinkParams: $recordingLinkParams)
        }
      `,
    });

    return (
      isResultValid({ result, invalidFieldsErrors, missingFieldError }) &&
      result.data.getMemberDownloadRecordingLink
    );
  };

  getMembers = async (orgId?: string) => {
    const resultGetMembers = await this.apolloClient.query({
      variables: { orgId },
      query: gql`
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
          }
        }
      `,
    });
    const { errors, data } = resultGetMembers || {};
    return { errors, members: data?.getMembers };
  };

  getMembersAppointments = async (orgId?: string) => {
    const result = await this.apolloClient.query({
      variables: { orgId },
      query: gql`
        query getMembersAppointments($orgId: String) {
          getMembersAppointments(orgId: $orgId) {
            memberId
            memberName
            userId
            userName
            start
            end
          }
        }
      `,
    });

    return result.data.getMembersAppointments;
  };

  getAppointment = async (id: string) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
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
    });
    return result.data.getAppointment;
  };

  getAvailabilities = async () => {
    const result = await this.apolloClient.query({
      query: gql`
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
    });

    return result.data.getAvailabilities;
  };

  getCommunication = async ({
    getCommunicationParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    getCommunicationParams: GetCommunicationParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }) => {
    const result = await this.apolloClient.query({
      variables: { getCommunicationParams },
      query: gql`
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
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.getCommunication
    );
  };

  getMemberUnreadMessagesCount = async () => {
    const result = await this.apolloClient.query({
      query: gql`
        query getMemberUnreadMessagesCount {
          getMemberUnreadMessagesCount {
            memberId
            userId
            count
          }
        }
      `,
    });

    return result.data.getMemberUnreadMessagesCount;
  };

  getTwilioAccessToken = async () => {
    const result = await this.apolloClient.query({
      query: gql`
        query getTwilioAccessToken {
          getTwilioAccessToken
        }
      `,
    });

    return result.data.getTwilioAccessToken;
  };

  getMemberConfig = async ({
    id,
    invalidFieldsError,
  }: {
    id?: string;
    invalidFieldsError?: string;
  }) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
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
            language
            updatedAt
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else {
      return result.data.getMemberConfig;
    }
  };

  getUserConfig = async ({
    id,
    invalidFieldsError,
  }: {
    id: string;
    invalidFieldsError?: string;
  }) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getUserConfig($id: String!) {
          getUserConfig(id: $id) {
            userId
            accessToken
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toContain(invalidFieldsError);
    } else {
      return result.data.getUserConfig;
    }
  };

  getOrg = async ({ id }: { id: string }) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getOrg($id: String!) {
          getOrg(id: $id) {
            id
            name
            type
            zipCode
            trialDuration
          }
        }
      `,
    });

    return result.data.getOrg;
  };

  getRecordings = async ({ memberId }: { memberId: string }) => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
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
    });

    return result.data.getRecordings;
  };

  getJournal = async ({ id, invalidFieldsError }: { id; invalidFieldsError?: string }) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
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
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getJournal;
    }
  };

  getJournals = async () => {
    const result = await this.apolloClient.query({
      query: gql`
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
    });

    return result.data.getJournals;
  };

  getMemberUploadJournalImageLink = async ({
    getMemberUploadJournalImageLinkParams,
    missingFieldError,
    invalidFieldsErrors,
  }: {
    getMemberUploadJournalImageLinkParams: GetMemberUploadJournalImageLinkParams;
    missingFieldError?: string;
    invalidFieldsErrors?: string[];
  }) => {
    const result = await this.apolloClient.query({
      variables: { getMemberUploadJournalImageLinkParams },
      query: gql`
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
    });

    return (
      isResultValid({ result, missingFieldError, invalidFieldsErrors }) &&
      result.data.getMemberUploadJournalImageLink
    );
  };

  getMemberUploadJournalAudioLink = async ({
    getMemberUploadJournalAudioLinkParams,
    invalidFieldsError,
  }: {
    getMemberUploadJournalAudioLinkParams: GetMemberUploadJournalAudioLinkParams;
    invalidFieldsError?: string;
  }) => {
    const result = await this.apolloClient.query({
      variables: { getMemberUploadJournalAudioLinkParams },
      query: gql`
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
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getMemberUploadJournalAudioLink;
    }
  };

  getDailyReports = async ({
    dailyReportQueryInput,
  }: {
    dailyReportQueryInput: DailyReportQueryInput;
  }) => {
    const result = await this.apolloClient.query({
      variables: { dailyReportQueryInput },
      query: gql`
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
    });

    const { errors, data } = result || {};
    return { errors, dailyReports: data?.getDailyReports };
  };

  getCaregivers = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<Caregiver[]> => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
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
    });

    if (invalidFieldsError) {
      expect(result.errors[0][0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getCaregivers;
    }
  };

  getAlerts = async (): Promise<Dispatch[]> => {
    const result = await this.apolloClient.query({
      query: gql`
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
    });
    return result.data?.getAlerts;
  };

  getTodos = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId?;
    invalidFieldsError?: string;
  } = {}): Promise<Todo[]> => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
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
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getTodos;
    }
  };

  getTodoDones = async ({
    getTodoDonesParams,
    invalidFieldsError,
  }: {
    getTodoDonesParams?: GetTodoDonesParams;
    invalidFieldsError?: string;
  } = {}): Promise<TodoDone[]> => {
    const result = await this.apolloClient.query({
      variables: { getTodoDonesParams },
      query: gql`
        query getTodoDones($getTodoDonesParams: GetTodoDonesParams!) {
          getTodoDones(getTodoDonesParams: $getTodoDonesParams) {
            id
            memberId
            todoId
            done
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message || result.errors[0][0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getTodoDones;
    }
  };

  getMemberRedFlags = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<RedFlag[]> => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
        query getMemberRedFlags($memberId: String!) {
          getMemberRedFlags(memberId: $memberId) {
            id
            memberId
            createdBy
            type
            notes
            createdBy
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getMemberRedFlags;
    }
  };

  getMemberCarePlans = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId: string;
    invalidFieldsError?: string;
  }): Promise<CarePlan[]> => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
        query getMemberCarePlans($memberId: String!) {
          getMemberCarePlans(memberId: $memberId) {
            id
            memberId
            createdBy
            type {
              id
              description
              createdBy
              isCustom
            }
            notes
            createdBy
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getMemberCarePlans;
    }
  };

  getActiveQuestionnaires = async (): Promise<Questionnaire[]> => {
    const result = await this.apolloClient.query({
      query: gql`
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
          }
        }
      `,
    });

    return result.data.getActiveQuestionnaires;
  };

  getQuestionnaire = async ({
    id,
    invalidFieldsError,
  }: {
    id;
    invalidFieldsError?: string;
  }): Promise<Questionnaire> => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
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
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getQuestionnaire;
    }
  };

  getQuestionnaireResponse = async ({
    id,
    invalidFieldsError,
  }: {
    id;
    invalidFieldsError?: string;
  }): Promise<QuestionnaireResponse> => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getQuestionnaireResponse($id: String!) {
          getQuestionnaireResponse(id: $id) {
            id
            type
            result {
              severity
              score
              alert
            }
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getQuestionnaireResponse;
    }
  };

  getMemberQuestionnaireResponses = async ({
    memberId,
    invalidFieldsError,
  }: {
    memberId;
    invalidFieldsError?: string;
  }): Promise<QuestionnaireResponse[]> => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
        query getMemberQuestionnaireResponses($memberId: String!) {
          getMemberQuestionnaireResponses(memberId: $memberId) {
            id
            type
            answers {
              code
              value
            }
            createdBy
            createdAt
            result {
              score
              severity
            }
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(result.errors[0].message).toMatch(invalidFieldsError);
    } else {
      return result.data.getMemberQuestionnaireResponses;
    }
  };

  getCarePlanTypes = async (): Promise<CarePlanType[]> => {
    const result = await this.apolloClient.query({
      query: gql`
        query getCarePlanTypes {
          getCarePlanTypes {
            id
            description
            createdBy
            isCustom
          }
        }
      `,
    });
    return result.data?.getCarePlanTypes;
  };

  getBarrierTypes = async (): Promise<BarrierType[]> => {
    const result = await this.apolloClient.query({
      query: gql`
        query getBarrierTypes {
          getBarrierTypes {
            id
            description
            domain
            carePlanTypes {
              id
              description
              createdBy
              isCustom
            }
          }
        }
      `,
    });
    return result.data?.getBarrierTypes;
  };
}
