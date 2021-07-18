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
            name
            email
            roles
            photoUrl
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
            name
            dateOfBirth
            primaryCoach {
              id
              name
              email
              roles
              photoUrl
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
              name
              email
              roles
              photoUrl
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
        }
      `,
    });

    return resultGetMember.data.getMember;
  };

  getAppointment = async (id: string) => {
    const resultGetUser = await this.apolloClient.query({
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
          }
        }
      `,
    });
    return resultGetUser.data.getAppointment;
  };
}
