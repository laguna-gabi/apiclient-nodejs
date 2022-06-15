import { AppointmentStatus } from '@argus/hepiusClient';
import {
  BEFORE_ALL_TIMEOUT,
  generateRequestAppointmentParams,
  generateRequestHeaders,
  generateScheduleAppointmentParams,
} from '..';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import { addDays } from 'date-fns';
import { queryDaysLimit } from 'config';

describe('Integration tests : getMembersAppointments', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  it('should return members appointment filtered by orgId', async () => {
    const { member: member1, org } = await creators.createMemberUserAndOptionalOrg();
    const primaryUser1 = member1.users[0];
    const { member: member2 } = await creators.createMemberUserAndOptionalOrg({ orgId: org.id });
    const primaryUser2 = member1.users[0];

    const params1a = generateScheduleAppointmentParams({
      memberId: member1.id,
      userId: primaryUser1.id,
    });
    const params1b = generateScheduleAppointmentParams({
      memberId: member1.id,
      userId: primaryUser1.id,
      start: addDays(params1a.start, 1),
    });
    const params2a = generateScheduleAppointmentParams({
      memberId: member2.id,
      userId: primaryUser2.id,
      start: addDays(params1a.start, 2),
    });
    // Request appointment should not be on results, only showing status scheduled
    const params2b = generateRequestAppointmentParams({
      memberId: member2.id,
      userId: primaryUser2.id,
    });

    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params1a });
    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params1b });
    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params2a });
    await creators.handler.mutations.requestAppointment({ appointmentParams: params2b });

    const result = await creators.handler.queries.getMembersAppointments({ orgIds: [org.id] });
    const resultMember1 = await creators.handler.queries.getMember({
      id: member1.id,
      requestHeaders: generateRequestHeaders(member1.authId),
    });
    const resultMember2 = await creators.handler.queries.getMember({
      id: member2.id,
      requestHeaders: generateRequestHeaders(member2.authId),
    });

    expect(result.length).toEqual(3);

    expect(result).toEqual(
      expect.arrayContaining([
        {
          memberId: member1.id,
          memberName: `${resultMember1.firstName} ${resultMember1.lastName}`,
          userId: primaryUser1.id,
          userName: `${primaryUser1.firstName} ${primaryUser1.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        },
        {
          memberId: member1.id,
          memberName: `${resultMember1.firstName} ${resultMember1.lastName}`,
          userId: primaryUser1.id,
          userName: `${primaryUser1.firstName} ${primaryUser1.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        },
        {
          memberId: member2.id,
          memberName: `${resultMember2.firstName} ${resultMember2.lastName}`,
          userId: primaryUser2.id,
          userName: `${primaryUser2.firstName} ${primaryUser2.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        },
      ]),
    );
  });

  it('should return members appointment without supplying optional orgId', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();
    const primaryUser = member.users[0];

    await creators.handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member.id,
        userId: primaryUser.id,
      }),
    });

    const result = await creators.handler.queries.getMembersAppointments();

    expect(result.length).toBeGreaterThan(0);
  });

  it('should return empty array on members with orgId and no appointments', async () => {
    const { org } = await creators.createMemberUserAndOptionalOrg();
    await creators.createMemberUserAndOptionalOrg({ orgId: org.id });
    await creators.createMemberUserAndOptionalOrg({ orgId: org.id });

    const result = await handler.queries.getMembersAppointments({ orgIds: [org.id] });
    expect(result).toEqual([]);
  });

  it('should return members appointments for each', async () => {
    const { member: member1, user: user1, org } = await creators.createMemberUserAndOptionalOrg();
    const { member: member2, user: user2 } = await creators.createMemberUserAndOptionalOrg({
      orgId: org.id,
    });
    const member1AppointmentsCount = 3;
    const member2AppointmentsCount = 4;
    await Promise.all(
      Array.from(Array(member1AppointmentsCount)).map(async () => {
        await appointmentsActions.scheduleAppointment({ userId: user1.id, member: member1 });
      }),
    );
    await Promise.all(
      Array.from(Array(member2AppointmentsCount)).map(async () => {
        await appointmentsActions.scheduleAppointment({ userId: user2.id, member: member2 });
      }),
    );

    const result = await handler.queries.getMembersAppointments({ orgIds: [org.id] });
    expect(result.length).toEqual(member1AppointmentsCount + member2AppointmentsCount);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member1.id,
          userId: user1.id,
          memberName: `${member1.firstName} ${member1.lastName}`,
          userName: `${user1.firstName} ${user1.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        }),
        expect.objectContaining({
          memberId: member2.id,
          userId: user2.id,
          memberName: `${member2.firstName} ${member2.lastName}`,
          userName: `${user2.firstName} ${user2.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        }),
      ]),
    );
  });

  it('should exclude non org members from results', async () => {
    const { member: member1, user, org } = await creators.createMemberUserAndOptionalOrg();
    //excluding this org, member and user from results
    const { member: member2 } = await creators.createMemberUserAndOptionalOrg();

    await appointmentsActions.scheduleAppointment({ member: member1 });
    await appointmentsActions.scheduleAppointment({ member: member1 });
    await appointmentsActions.scheduleAppointment({ member: member2 });

    const result = await handler.queries.getMembersAppointments({ orgIds: [org.id] });
    expect(result.length).toEqual(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: member1.id,
          userId: user.id,
          memberName: `${member1.firstName} ${member1.lastName}`,
          userName: `${user.firstName} ${user.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
          status: AppointmentStatus.scheduled,
        }),
      ]),
    );
  });

  it('should sort results by start timestamp desc', async () => {
    const { member, user, org } = await creators.createMemberUserAndOptionalOrg();

    const member1AppointmentsCount = 3;
    await Promise.all(
      Array.from(Array(member1AppointmentsCount)).map(async () => {
        await appointmentsActions.scheduleAppointment({ userId: user.id, member });
      }),
    );

    const result = await handler.queries.getMembersAppointments({ orgIds: [org.id] });
    const isSorted = result
      .map((item) => item.start)
      .every((v, i, a) => !i || new Date(a[i - 1]).getTime() >= new Date(v).getTime());

    expect(result.length).toEqual(member1AppointmentsCount);
    expect(isSorted).toBeTruthy();
  });

  /* eslint-disable-next-line max-len */
  it(`should not include appointments older that ${queryDaysLimit.getMembersAppointments} days ago`, async () => {
    const { member, org } = await creators.createMemberUserAndOptionalOrg();

    const startDate1 = new Date();
    startDate1.setDate(startDate1.getDate() - (queryDaysLimit.getMembersAppointments + 1));

    await handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        start: startDate1,
      }),
    });

    const startDate2 = new Date();
    startDate2.setDate(startDate2.getDate() - (queryDaysLimit.getMembersAppointments - 1));
    await handler.mutations.scheduleAppointment({
      appointmentParams: generateScheduleAppointmentParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        start: startDate2,
      }),
    });

    const result = await handler.queries.getMembersAppointments({ orgIds: [org.id] });
    expect(result.length).toEqual(1);
    expect(new Date(result[0].start)).toEqual(startDate2);
  });
});
