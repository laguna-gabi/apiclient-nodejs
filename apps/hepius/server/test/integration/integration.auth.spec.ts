import { UserRole } from '@argus/hepiusClient';
import { generateId } from '@argus/pandora';
import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateRequestHeaders,
  generateUpdateUserParams,
} from '..';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';

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

  // eslint-disable-next-line max-len
  it('expecting `member` to be denied access to a secure (`coach` only) endpoint (RBAC)', async () => {
    const { errors } = await handler.queries.getMembers({
      orgId: handler.lagunaOrg.id,
      requestHeaders,
    });

    expect(errors?.[0]?.message).toBe('Forbidden resource');
  });

  // eslint-disable-next-line max-len
  it('expecting `member` to be granted access get his own member information (RBAC+ACE)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const response = await handler.queries.getMember({
      id: handler.patientZero.id.toString(),
      requestHeaders,
    });

    expect(response).toBeTruthy();
  });

  // eslint-disable-next-line max-len
  it('expecting `member` to be granted access to get his own member information when member id is not supplied (populated / RBAC+ACE)', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const response = await handler.queries.getMember({
      requestHeaders,
    });

    expect(response).toBeTruthy();
  });

  // eslint-disable-next-line max-len
  it('expecting non-Laguna (customer) coach to be granted access to modify a member in provisioned org', async () => {
    const { member, user } = await creators.createMemberUserAndOptionalOrg();

    // provision the user to the member's org
    await handler.mutations.updateUser({
      updateUserParams: generateUpdateUserParams({
        id: user.id,
        orgs: [member.org.id, generateId()],
        roles: [UserRole.coach],
      }),
      requestHeaders: handler.defaultAdminRequestHeaders,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // `addCaregiver` request is allowed for customer coach
    const response = handler.mutations.addCaregiver({
      addCaregiverParams: generateAddCaregiverParams({ memberId: member.id }),
      requestHeaders: generateRequestHeaders(user.authId),
    });

    expect(response).toBeTruthy();
  });

  // eslint-disable-next-line max-len
  it('expecting non-Laguna (customer) coach to be denied access to modify a member in a non provisioned org', async () => {
    const { member, user } = await creators.createMemberUserAndOptionalOrg();

    // provision the user to the member's org
    await handler.mutations.updateUser({
      updateUserParams: generateUpdateUserParams({
        id: user.id,
        orgs: [generateId(), generateId()],
        roles: [UserRole.coach],
      }),
      requestHeaders: handler.defaultAdminRequestHeaders,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // `addCaregiver` request is allowed for customer coach
    const response = await handler.mutations.addCaregiver({
      addCaregiverParams: generateAddCaregiverParams({ memberId: member.id }),
      requestHeaders: generateRequestHeaders(user.authId),
    });

    expect(response).toBeFalsy();
  });

  it('expecting member to be allowed access to add a caregiver to self (populated)', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // `addCaregiver` request is allowed for customer coach
    const response = await handler.mutations.addCaregiver({
      addCaregiverParams: generateAddCaregiverParams(), // <- member id is undefined
      requestHeaders: generateRequestHeaders(member.authId),
    });

    expect(response).toBeTruthy();
  });
});
