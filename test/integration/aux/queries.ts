import gql from 'graphql-tag';
import { ApolloServerTestClient } from 'apollo-server-testing';

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
            phoneNumber
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

  getMember = async () => {
    const resultGetMember = await this.apolloClient.query({
      query: gql`
        query getMember {
          getMember {
            id
            phoneNumber
            deviceId
            firstName
            lastName
            dateOfBirth
            dischargeNotesLink
            dischargeInstructionsLink
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
            }
            primaryCoach {
              id
              firstName
              lastName
              email
              roles
              avatar
              description
              createdAt
              phoneNumber
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
            users {
              id
              firstName
              lastName
              email
              roles
              avatar
              description
              createdAt
              phoneNumber
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
            dischargeDate
            goals {
              id
              title
              state
              deadline
            }
            actionItems {
              id
              title
              state
              deadline
            }
            fellowName
            drgDesc
            readmissionRisk
            phoneSecondary
            createdAt
          }
        }
      `,
    });

    return resultGetMember.data.getMember;
  };

  getMembers = async (orgId?: string) => {
    const resultGetMembers = await this.apolloClient.query({
      variables: { orgId },
      query: gql`
        query getMembers($orgId: String) {
          getMembers(orgId: $orgId) {
            id
            name
            phoneNumber
            dischargeDate
            adherence
            wellbeing
            createdAt
            goalsCount
            actionItemsCount
            primaryCoach {
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
}
