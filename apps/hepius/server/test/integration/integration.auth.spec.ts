import { CarePlanStatus, UserRole } from '@argus/hepiusClient';
import { generateId } from '@argus/pandora';
import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateRequestHeaders,
  generateUpdateCarePlanParams,
  generateUpdateUserParams,
  submitMockCareWizard,
} from '..';
import { AceOptions, DecoratorType } from '../../src/common';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';

enum Access {
  allowed = 'allowed',
  denied = 'denied',
}

describe('Integration tests : RBAC / ACE', () => {
  const handler: Handler = new Handler();
  let requestHeaders;
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    requestHeaders = generateRequestHeaders(handler.patientZero.authId);
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  it.skip('to confirm that all endpoints include ACE annotation', async () => {
    // identify all routes with @Roles annotation where @Ace is not defined
    expect(
      (
        await handler.discoveryService.providerMethodsWithMetaAtKey<DecoratorType>(
          DecoratorType.roles,
        )
      )
        .filter(
          (method) =>
            !handler.reflector.get<AceOptions>(
              DecoratorType.aceOptions,
              method.discoveredMethod.handler,
            ),
        )
        .map(
          (method) => `'${method.discoveredMethod.methodName}': endpoint is missing ACE annotation`,
        ),
    ).toEqual([]);
  });

  // eslint-disable-next-line max-len
  it('expecting `member` to be denied access to a secure (`coach` only) endpoint (RBAC)', async () => {
    const { errors } = await handler.queries.getMembers({
      orgIds: [handler.lagunaOrg.id],
      requestHeaders,
    });

    expect(errors?.[0]?.message).toBe('Forbidden resource');
  });

  // eslint-disable-next-line max-len
  it('expecting `member` to be ALLOWED access get his own member information (RBAC+ACE)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const response = await handler.queries.getMember({
      id: handler.patientZero.id.toString(),
      requestHeaders,
    });

    expect(response).toBeTruthy();
  });

  // eslint-disable-next-line max-len
  it('expecting `member` to be ALLOWED access to get his own member information when member id is not supplied (populated / RBAC+ACE)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const response = await handler.queries.getMember({
      requestHeaders,
    });

    expect(response).toBeTruthy();
  });

  test.each([Access.allowed, Access.denied])(
    // eslint-disable-next-line max-len
    'expecting non-Laguna (customer) coach to be %p to modify a member by member id based on org provisioning',
    async (access) => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      await handler.mutations.updateUser({
        updateUserParams: generateUpdateUserParams({
          id: user.id,
          orgs: access === Access.allowed ? [member.org.toString()] : [generateId()],
          roles: [UserRole.coach],
        }),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });

      const result = await handler.mutations.addCaregiver({
        addCaregiverParams: generateAddCaregiverParams({ memberId: member.id }),
        requestHeaders: generateRequestHeaders(user.authId),
      });

      if (access === Access.allowed) {
        expect(result).toBeTruthy();
      } else {
        expect(result).toBeFalsy();
      }
    },
  );

  test.each([Access.allowed, Access.denied])(
    // eslint-disable-next-line max-len
    'expecting member to be %p access to add a caregiver to self - member id should be populated',
    async (access) => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // `addCaregiver` request is allowed for customer coach
      const result = await handler.mutations.addCaregiver({
        addCaregiverParams: generateAddCaregiverParams({
          memberId: access === Access.allowed ? undefined : generateId(),
        }), // <- when member id is undefined it is properly populated, however, if set we compare to client id
        requestHeaders: generateRequestHeaders(member.authId),
      });

      if (access === Access.allowed) {
        expect(result).toBeTruthy();
      } else {
        expect(result).toBeFalsy();
      }
    },
  );

  test.each([Access.allowed, Access.denied])(
    // eslint-disable-next-line max-len
    `expecting non-Laguna (customer) coach to be %p to modify by entity id associated with a member based on org provisioning`,
    async (access) => {
      const {
        member: { id: memberId, org },
        user: { authId, id: userId },
      } = await creators.createMemberUserAndOptionalOrg();

      await submitMockCareWizard(handler, memberId);

      const memberCarePlans = await handler.queries.getMemberCarePlans({
        memberId,
        requestHeaders: generateRequestHeaders(authId),
      });
      expect(memberCarePlans.length).toEqual(1);
      const carePlanId = memberCarePlans[0].id;

      const updateCarePlanParams = generateUpdateCarePlanParams({
        id: carePlanId,
        notes: 'new notes',
        status: CarePlanStatus.completed,
      });

      // set user to be a `coach` (keep member's org provisioning)
      await handler.mutations.updateUser({
        updateUserParams: generateUpdateUserParams({
          id: userId,
          orgs: access === Access.allowed ? [org.toString()] : [generateId()],
          roles: [UserRole.coach],
        }),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });

      const result = await handler.mutations.updateCarePlan({
        updateCarePlanParams,
        requestHeaders: generateRequestHeaders(authId),
      });

      if (access === Access.allowed) {
        expect(result).toBeTruthy();
      } else {
        expect(result).toBeFalsy();
      }
    },
  );

  test.each([Access.allowed, Access.denied])(
    // eslint-disable-next-line max-len
    `expecting non-Laguna (customer) coach to be %p to query by org id based on org provisioning`,
    async (access) => {
      const {
        user: { id: userId, authId, orgs },
        member: { id: memberId },
      } = await creators.createMemberUserAndOptionalOrg();

      await handler.mutations.updateUser({
        updateUserParams: generateUpdateUserParams({
          id: userId,
          roles: [UserRole.coach], // <- coach role
          orgs,
        }),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });
      const orgIds = access === Access.allowed ? orgs.map((org) => org.toString()) : [generateId()];
      const result = await handler.queries.getMembers({
        orgIds,
        requestHeaders: generateRequestHeaders(authId),
      });

      // only the member for which this coach user is provisioned for will
      if (access === Access.allowed) {
        expect(result.members.length).toEqual(1);
        expect(result.members[0].id).toEqual(memberId);
      } else {
        expect(result.members).toEqual(undefined);
      }
    },
  );

  // eslint-disable-next-line max-len
  it(`expecting non-Laguna (customer) coach to be allowed to query by org id based on org provisioning - empty org list`, async () => {
    const {
      user: { id: userId, authId, orgs },
      member: { id },
    } = await creators.createMemberUserAndOptionalOrg();

    await handler.mutations.updateUser({
      updateUserParams: generateUpdateUserParams({
        id: userId,
        roles: [UserRole.coach], // <- coach role
        orgs,
      }),
      requestHeaders: handler.defaultAdminRequestHeaders,
    });

    const result = await handler.queries.getMembers({
      requestHeaders: generateRequestHeaders(authId),
    });

    // only the member for which this coach user is provisioned for will
    expect(result.members.length).toEqual(1);
    expect(result.members[0].id).toEqual(id);
  });
});
