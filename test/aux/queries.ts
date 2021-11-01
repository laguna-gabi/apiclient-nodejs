import { ApolloServerTestClient } from 'apollo-server-testing';
import gql from 'graphql-tag';
import { DailyReportQueryInput } from '../../src/dailyReport';
import { GetCommunicationParams } from '../../src/communication';
import { DischargeDocumentsLinks, RecordingLinkParams } from '../../src/member';
import { GetSlotsParams } from '../../src/user';

export class Queries {
  constructor(private readonly apolloClient: ApolloServerTestClient) {}

  getUser = async (id: string) => {
    const resultGetUser = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getUser($id: String!) {
          getUser(id: $id) {
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
        query getMemberDownloadDischargeDocumentsLinks($id: String!) {
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
    invalidFieldsError,
  }: {
    recordingLinkParams?: RecordingLinkParams;
    invalidFieldsError?: string;
  } = {}): Promise<string> => {
    const result = await this.apolloClient.query({
      variables: { recordingLinkParams },
      query: gql`
        query getMemberUploadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
          getMemberUploadRecordingLink(recordingLinkParams: $recordingLinkParams)
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else {
      return result.data.getMemberUploadRecordingLink;
    }
  };

  getMemberDownloadRecordingLink = async ({
    recordingLinkParams,
    invalidFieldsError,
  }: {
    recordingLinkParams?: RecordingLinkParams;
    invalidFieldsError?: string;
  } = {}): Promise<string> => {
    const result = await this.apolloClient.query({
      variables: { recordingLinkParams },
      query: gql`
        query getMemberDownloadRecordingLink($recordingLinkParams: RecordingLinkParams!) {
          getMemberDownloadRecordingLink(recordingLinkParams: $recordingLinkParams)
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else {
      return result.data.getMemberDownloadRecordingLink;
    }
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
            dischargeDate
            adherence
            wellbeing
            createdAt
            goalsCount
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
  }: {
    getCommunicationParams: GetCommunicationParams;
    missingFieldError?: string;
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

    if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
      return;
    }
    return result.data.getCommunication;
  };

  getMemberUnreadMessagesCount = async ({
    memberId,
    missingFieldError,
    invalidFieldsError,
  }: {
    memberId;
    invalidFieldsError?: string;
    missingFieldError?: string;
  }) => {
    const result = await this.apolloClient.query({
      variables: { memberId },
      query: gql`
        query getMemberUnreadMessagesCount($memberId: String!) {
          getMemberUnreadMessagesCount(memberId: $memberId) {
            memberId
            userId
            count
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else if (missingFieldError) {
      expect(result.errors[0].message).toMatch(missingFieldError);
    } else {
      return result.data.getMemberUnreadMessagesCount;
    }
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
    id: string;
    invalidFieldsError?: string;
  }) => {
    const result = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getMemberConfig($id: String!) {
          getMemberConfig(id: $id) {
            memberId
            externalUserId
            platform
            isPushNotificationsEnabled
            isAppointmentsReminderEnabled
            isRecommendationsEnabled
            articlesPath
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
          }
        }
      `,
    });

    return result.data.getRecordings;
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
}
