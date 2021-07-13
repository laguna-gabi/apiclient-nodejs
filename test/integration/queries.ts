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
          }
        }
      `,
    });
    return resultGetUser.data.getUser;
  };

  getMember = async (id: string) => {
    const resultGetMember = await this.apolloClient.query({
      variables: { id },
      query: gql`
        query getMember($id: String!) {
          getMember(id: $id) {
            id
            phoneNumber
            name
            dateOfBirth
            primaryCoach {
              id
              name
              email
              roles
              photoUrl
            }
            users {
              id
              name
              email
              roles
              photoUrl
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
