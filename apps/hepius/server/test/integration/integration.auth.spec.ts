import { CarePlanStatus, UserRole } from '@argus/hepiusClient';
import { generateId } from '@argus/pandora';
import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateAvailabilityInput,
  generateCreateTodoParams,
  generateOrgParams,
  generateRequestHeaders,
  generateScheduleAppointmentParams,
  generateUpdateCarePlanParams,
  generateUpdateUserParams,
  submitMockCareWizard,
} from '..';
import { AceOptions, DecoratorType, HttpErrorCodes, HttpErrorMessage } from '../../src/common';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import { isEqual, sortBy } from 'lodash';
import { add, startOfToday, startOfTomorrow } from 'date-fns';
import { defaultSlotsParams } from '../../src/user';
import { date as fakerDate } from 'faker';

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

  it('to confirm that all endpoints include ACE annotation', async () => {
    const waiverList = ['createOrSetActionItem'];
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
            ) && !!waiverList.includes[method.discoveredMethod.methodName],
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

    expect(errors?.[0]?.message).toBe(HttpErrorMessage.get(HttpErrorCodes.forbidden));
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
      const { member, user, org } = await creators.createMemberUserAndOptionalOrg();

      await handler.mutations.updateUser({
        updateUserParams: generateUpdateUserParams({
          id: user.id,
          orgs: access === Access.allowed ? [org.id] : [generateId()],
          roles: [UserRole.coach],
        }),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });

      if (access === Access.allowed) {
        expect(
          await handler.mutations.addCaregiver({
            addCaregiverParams: generateAddCaregiverParams({ memberId: member.id }),
            requestHeaders: generateRequestHeaders(user.authId),
          }),
        ).toBeTruthy();
      } else {
        expect(
          await handler.mutations.addCaregiver({
            addCaregiverParams: generateAddCaregiverParams({ memberId: member.id }),
            requestHeaders: generateRequestHeaders(user.authId),
            missingFieldError: HttpErrorMessage.get(HttpErrorCodes.forbidden),
          }),
        ).toBeFalsy();
      }
    },
  );

  test.each([Access.allowed, Access.denied])(
    // eslint-disable-next-line max-len
    'expecting member to be %p access to add a caregiver to self - member id should be populated',
    async (access) => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      // `addCaregiver` request is allowed for customer coach
      if (access === Access.allowed) {
        expect(
          await handler.mutations.addCaregiver({
            addCaregiverParams: generateAddCaregiverParams(), // <- when member id is undefined it is properly populated, however, if set we compare to client id
            requestHeaders: generateRequestHeaders(member.authId),
          }),
        ).toBeTruthy();
      } else {
        expect(
          await handler.mutations.addCaregiver({
            addCaregiverParams: generateAddCaregiverParams({
              memberId: generateId(), // <- when member id set we compare to client id
            }),
            requestHeaders: generateRequestHeaders(member.authId),
            missingFieldError: HttpErrorMessage.get(HttpErrorCodes.forbidden),
          }),
        ).toBeFalsy();
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
          orgs: access === Access.allowed ? [org.id.toString()] : [generateId()],
          roles: [UserRole.coach],
        }),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });

      if (access === Access.allowed) {
        expect(
          await handler.mutations.updateCarePlan({
            updateCarePlanParams,
            requestHeaders: generateRequestHeaders(authId),
          }),
        ).toBeTruthy();
      } else {
        expect(
          await handler.mutations.updateCarePlan({
            updateCarePlanParams,
            requestHeaders: generateRequestHeaders(authId),
            missingFieldError: HttpErrorMessage.get(HttpErrorCodes.forbidden),
          }),
        ).toBeFalsy();
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
        expect(result.errors[0].message).toContain(HttpErrorMessage.get(HttpErrorCodes.forbidden));
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

  // eslint-disable-next-line max-len
  it(`expecting non-Laguna (customer) coach to see only availability of own organization`, async () => {
    // availability for coach user#1 in random org
    const user1 = await creators.createAndValidateUser({ roles: [UserRole.coach] });
    const { ids: user1Availabilities } = await creators.createAndValidateAvailabilities(5, user1);

    // availability for coach user#2 in random org
    const user2 = await creators.createAndValidateUser({ roles: [UserRole.coach] });
    await creators.createAndValidateAvailabilities(5, user2);

    // coach user#3 provisioned for user1's orgs and user2's orgs
    const user3 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [...user1.orgs, ...user2.orgs],
    });

    //  coach user#1 should see only own organization
    expect(
      isEqual(
        sortBy(
          (
            await handler.queries.getAvailabilities({
              requestHeaders: generateRequestHeaders(user1.authId),
            })
          ).map((availability) => availability.id),
        ),
        sortBy(user1Availabilities),
      ),
    ).toBeTruthy();

    // coach user#3 should see both user1's and user2's availabilities
    expect(
      (
        await handler.queries.getAvailabilities({
          requestHeaders: generateRequestHeaders(user3.authId),
        })
      ).map((availability) => availability.id).length,
    ).toEqual(10);
  });

  // eslint-disable-next-line max-len
  it('expecting non-Laguna (customer) coach to see only slots of own organization', async () => {
    const { member, org } = await creators.createMemberUserAndOptionalOrg();
    const user1 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [org.id],
    });

    const user2 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [generateId()],
    });

    await handler.mutations.createAvailabilities({
      requestHeaders: generateRequestHeaders(user1.authId),
      availabilities: [
        generateAvailabilityInput({
          start: add(startOfToday(), { hours: 10 }),
          end: add(startOfToday(), { hours: 22 }),
        }),
        generateAvailabilityInput({
          start: add(startOfTomorrow(), { hours: 10 }),
          end: add(startOfTomorrow(), { hours: 22 }),
        }),
      ],
    });

    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: user1.id,
      start: add(startOfToday(), { hours: 9 }),
      end: add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
    });
    const appointment = await handler.mutations.scheduleAppointment({ appointmentParams });

    expect(
      (
        await handler.queries.getUserSlots({
          getSlotsParams: {
            appointmentId: appointment.id,
            notBefore: add(startOfToday(), { hours: 10 }),
          },
          requestHeaders: generateRequestHeaders(user1.authId),
        })
      )?.slots?.length,
    ).toBeTruthy();

    expect(
      (
        await handler.queries.getUserSlots({
          getSlotsParams: {
            appointmentId: appointment.id,
            notBefore: add(startOfToday(), { hours: 10 }),
          },
          requestHeaders: generateRequestHeaders(user2.authId), // user2 is not allowed to access user1 data
        })
      )?.slots?.length,
    ).toBeFalsy();
  });

  it('expecting non-Laguna (customer) coach to see only users in own organization', async () => {
    const org1 = await creators.createAndValidateOrg();

    const user1 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [org1.id],
    });

    const user2 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [org1.id, generateId()],
    });

    const user3 = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [generateId()],
    });

    // user1 should be able to see self and user2
    expect(
      (
        await handler.queries.getUsers({
          requestHeaders: generateRequestHeaders(user1.authId),
        })
      ).map((user) => user.id),
    ).toEqual([user1.id, user2.id]);

    // user3 should be able to see only self
    expect(
      (
        await handler.queries.getUsers({
          requestHeaders: generateRequestHeaders(user3.authId),
        })
      ).map((user) => user.id),
    ).toEqual([user3.id]);
  });

  it('expecting non-Laguna (customer) coach to only get own org data', async () => {
    const { id: orgId1 } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });

    const { id: orgId2 } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });

    const user = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [orgId1],
    });

    expect(
      (
        await handler.queries.getOrg({
          id: orgId1,
          requestHeaders: generateRequestHeaders(user.authId),
        })
      )?.id,
    ).toEqual(orgId1);

    await handler.queries.getOrg({
      id: orgId2,
      requestHeaders: generateRequestHeaders(user.authId),
      invalidFieldsError: 'Forbidden',
    });
  });

  it('expecting non-Laguna (customer) coach to only get appointments in own org', async () => {
    const { member: member1, org } = await creators.createMemberUserAndOptionalOrg();
    const { member: member2 } = await creators.createMemberUserAndOptionalOrg();
    const start = fakerDate.soon(4);

    // `coach` user provisioned for member1 organization
    const user = await creators.createAndValidateUser({
      roles: [UserRole.coach],
      orgs: [org.id, generateId()],
    });

    await creators.handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member1.id,
        userId: user.id,
        start,
      }),
    });
    await creators.handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member1.id,
        userId: user.id,
        start: add(start, { days: 1 }),
      }),
    });
    await creators.handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member2.id,
        userId: generateId(),
      }),
    });

    const result = await creators.handler.queries.getMembersAppointments({
      orgIds: [org.id],
      requestHeaders: generateRequestHeaders(user.authId),
    });

    expect(result.length).toEqual(2);
    expect(result.find((appointment) => appointment.memberId !== member1.id)).toBeUndefined();
  });

  test.each([Access.allowed, Access.denied])(
    'expecting non-Laguna (customer) coach to only get member in own org',
    async (access) => {
      const { member: member1, org } = await creators.createMemberUserAndOptionalOrg();
      const { member: member2 } = await creators.createMemberUserAndOptionalOrg();

      // `coach` user provisioned for member1 organization
      const user = await creators.createAndValidateUser({
        roles: [UserRole.coach],
        orgs: [org.id, generateId()],
      });

      if (access === Access.allowed) {
        expect(
          await handler.queries.getMember({
            id: member1.id,
            requestHeaders: generateRequestHeaders(user.authId),
          }),
        ).toBeTruthy();
      } else {
        expect(
          await handler.queries.getMember({
            id: member2.id,
            requestHeaders: generateRequestHeaders(user.authId),
            invalidFieldsError: HttpErrorMessage.get(HttpErrorCodes.forbidden),
          }),
        ).toBeFalsy();
      }
    },
  );

  it('expecting non-Laguna (customer) coach to only get member in recent journey org', async () => {
    const { member, user: oldUser } = await creators.createMemberUserAndOptionalOrg();
    const newOrg = await creators.createAndValidateOrg();
    const user = await creators.createAndValidateUser({ orgs: [newOrg.id] });

    await handler.mutations.createTodo({
      createTodoParams: generateCreateTodoParams({ memberId: member.id }),
      requestHeaders: generateRequestHeaders(member.authId),
    });

    //creating a new journey
    await handler.journeyService.create({
      memberId: member.id,
      orgId: newOrg.id,
    });
    //create a new todo in recent journey
    const { id: todoId } = await handler.mutations.createTodo({
      createTodoParams: generateCreateTodoParams({ memberId: member.id }),
      requestHeaders: generateRequestHeaders(member.authId),
    });

    //validating new user can request data for the recent journey
    expect(
      await handler.queries.getMember({
        id: member.id,
        requestHeaders: generateRequestHeaders(user.authId),
      }),
    ).toBeTruthy();

    //validating that the not recent journey user can't access the member
    await handler.queries.getMember({
      id: member.id,
      requestHeaders: generateRequestHeaders(oldUser.authId),
      invalidFieldsError: HttpErrorMessage.get(HttpErrorCodes.forbidden),
    });

    const todoResults = await handler.queries.getTodos({ memberId: member.id });
    expect(todoResults).toEqual(expect.arrayContaining([expect.objectContaining({ id: todoId })]));
  });
});
