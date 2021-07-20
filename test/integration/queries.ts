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
            photoUrl
            description
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
              photoUrl
              description
              appointments {
                id
                notBefore
                method
                status
                start
                end
              }
            }
            users {
              id
              firstName
              lastName
              email
              roles
              photoUrl
              description
              appointments {
                id
                notBefore
                method
                status
                start
                end
              }
            }
            sex
            email
            language
            zipCode
            dischargeDate
          }
        }
      `,
    });

    return resultGetMember.data.getMember;
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
