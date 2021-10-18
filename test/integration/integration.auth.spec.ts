import { Roles } from '../../src/auth/roles';
import { Handler } from '../aux/handler';

describe('Integration tests : RBAC', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll(true);
    handler.mockCommunication();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  enum EndpointType {
    USER_ALLOWED,
    MEMBER_ALLOWED,
  }

  it.each([
    [
      'expecting member to not be allowed to access a secure (admin only) endpoint',
      Roles.Member,
      EndpointType.USER_ALLOWED,
      'Forbidden resource',
    ],
    [
      'expecting admin user to be allowed to access a secure endpoint',
      Roles.User,
      EndpointType.USER_ALLOWED,
      undefined,
    ],
    [
      'expecting invalid user to not be allowed to access a secure (admin only) endpoint',
      Roles.Anonymous,
      EndpointType.USER_ALLOWED,
      'Forbidden resource',
    ],
    [
      'expecting member to be allowed to access a secure (member-allowed) endpoint',
      Roles.Member,
      EndpointType.MEMBER_ALLOWED,
      undefined,
    ],
  ])('Auth Integration tests: %s', async (message, role, endpointType, expectedError) => {
    let authId;
    switch (role) {
      case Roles.Member: {
        authId = handler.patientZero.authId;
        break;
      }
      case Roles.User: {
        authId = handler.adminUser.authId;
        break;
      }
      case Roles.Anonymous: {
        authId = handler.adminUser.authId + 'invalid';
        break;
      }
    }

    switch (endpointType) {
      case EndpointType.USER_ALLOWED: {
        const { errors } = await handler
          .setContextUser(undefined, authId)
          .queries.getMembers(handler.lagunaOrg.id);

        expect(errors?.[0]?.message).toBe(expectedError);
        break;
      }
      case EndpointType.MEMBER_ALLOWED: {
        const { errors } = await handler
          .setContextUser(undefined, authId)
          .queries.getMember({ id: handler.patientZero.id.toString() });

        expect(errors?.[0]?.message).toBe(expectedError);
        break;
      }
    }
  });
});
