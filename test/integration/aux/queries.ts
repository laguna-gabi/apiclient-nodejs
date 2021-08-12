import gql from 'graphql-tag';
import { ApolloServerTestClient } from 'apollo-server-testing';
import { GetCommunicationParams } from '../../../src/communication';
import { DischargeDocumentsLinks } from '../../../src/member';

export class Queries {
  constructor(private readonly apolloClient: ApolloServerTestClient) {}

  getUser = async (id: string) => {
    const resultGetUser = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getUser($id: String!) {
          getUser(id: $id) {
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
            }
          }
        }
      `,
    });

    return resultGetUser.data.getUser;
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
                notes {
                  notes {
                    key
                    value
                  }
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
          }
        }
      `,
    });

    invalidFieldsError && expect(invalidFieldsError).toEqual(resultGetMember.errors[0].message);
    return resultGetMember.data.getMember;
  };

  getMemberDischargeDocumentsLinks = async ({
    invalidFieldsError,
  }: { invalidFieldsError?: string } = {}): Promise<DischargeDocumentsLinks> => {
    const result = await this.apolloClient.query({
      query: gql`
        query getMemberDischargeDocumentsLinks {
          getMemberDischargeDocumentsLinks {
            dischargeNotesLink
            dischargeInstructionsLink
          }
        }
      `,
    });

    if (invalidFieldsError) {
      expect(invalidFieldsError).toEqual(result.errors[0].message);
    } else {
      return result.data.getMemberDischargeDocumentsLinks;
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

    return resultGetMembers.data.getMembers;
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
            noShow {
              noShow
              reason
            }
            notes {
              notes {
                key
                value
              }
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
}
