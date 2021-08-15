import { generateId, generateScheduleAppointmentParams } from '../index';
import { Member, MemberSummary } from '../../src/member';
import { Handler } from './aux/handler';
import { AppointmentsIntegrationActions } from './aux/appointments';
import { Creators } from './aux/creators';
import { date } from 'faker';

describe('Integration tests : getMembers', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('should return nothing for none existing org', async () => {
    const membersResult = await handler.queries.getMembers(generateId());
    expect(membersResult.length).toEqual(0);
  });

  it('should return nothing for no members on org', async () => {
    const org = await creators.createAndValidateOrg();
    const membersResult = await handler.queries.getMembers(org.id);
    expect(membersResult.length).toEqual(0);
  });

  it('should call with a default member(no: appointments, goals, ai, ..)', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member1: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    const member2: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const membersResult = await handler.queries.getMembers(org.id);

    const compareResults = (result: MemberSummary, member: Member) => {
      expect(result).toEqual(
        expect.objectContaining({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          dischargeDate: member.dischargeDate,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 0,
          actionItemsCount: 0,
          primaryUser: expect.objectContaining({
            id: primaryUser.id,
            firstName: primaryUser.firstName,
            lastName: primaryUser.lastName,
            avatar: primaryUser.avatar,
          }),
          nextAppointment: null,
          appointmentsCount: 0,
        }),
      );
    };

    expect(membersResult.length).toEqual(2);
    compareResults(membersResult[0], member1);
    compareResults(membersResult[1], member2);
  });

  it.only('should call with a all member parameters', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    await creators.createAndValidateAppointment({ userId: primaryUser.id, member });
    const appointment = await appointmentsActions.scheduleAppointment(primaryUser.id, member);
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createActionItem);

    handler.setContextUser(member.deviceId);
    const memberResult = await handler.queries.getMember();
    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        id: memberResult.id,
        name: `${memberResult.firstName} ${memberResult.lastName}`,
        phone: memberResult.phone,
        dischargeDate: memberResult.dischargeDate,
        adherence: memberResult.scores.adherence,
        wellbeing: memberResult.scores.wellbeing,
        createdAt: memberResult.createdAt,
        goalsCount: 2,
        actionItemsCount: 1,
        primaryUser: expect.objectContaining({
          id: primaryUser.id,
          firstName: primaryUser.firstName,
          lastName: primaryUser.lastName,
          avatar: primaryUser.avatar,
        }),
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  it('should call having a single scheduled appointment', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    const appointment = await appointmentsActions.scheduleAppointment(primaryUser.id, member);

    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        id: member.id,
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  it('should return no nextAppointment on no scheduled appointments', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    await appointmentsActions.requestAppointment(primaryUser.id, member);
    const appointment = await appointmentsActions.scheduleAppointment(primaryUser.id, member);
    await handler.mutations.endAppointment({ endAppointmentParams: { id: appointment.id } });

    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        nextAppointment: null,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should return most recent scheduled appointment (start time) when it was scheduled before', async () => {
    /* eslint-enable max-len*/
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: userId } = primaryUser;
    const { id: memberId }: Member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const start1 = new Date();
    start1.setHours(start1.getHours() + 2);
    const appointment1 = await generateAppointment({ userId, memberId, start: start1 });
    const start2 = new Date();
    start2.setHours(start1.getHours() + 4);
    const appointment2 = await generateAppointment({ userId, memberId, start: start2 });

    const membersResult = await handler.queries.getMembers(org.id);

    expect(appointment1.id).toEqual(appointment2.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment2.start,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should return most recent scheduled appointment (start time) when it was scheduled after', async () => {
    /* eslint-enable max-len*/
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: userId } = primaryUser;
    const { id: memberId } = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const start1 = new Date();
    start1.setHours(start1.getHours() + 2);
    const appointment1 = await generateAppointment({ userId, memberId, start: start1 });
    const start2 = new Date();
    start2.setHours(start2.getHours() + 1);
    const appointment2 = await generateAppointment({ userId, memberId, start: start2 });

    expect(appointment1.id).toEqual(appointment2.id);
    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment2.start,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should handle primaryUser and users appointments in nextAppointment calculations', async () => {
    /* eslint-enable max-len*/
    const primaryUser = await creators.createAndValidateUser();
    const user1 = await creators.createAndValidateUser();
    const user2 = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: memberId } = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [user1, primaryUser, user2],
    });

    let startPrimaryUser = new Date();
    startPrimaryUser.setHours(startPrimaryUser.getHours() + 10);
    await generateAppointment({ userId: primaryUser.id, memberId, start: startPrimaryUser });
    startPrimaryUser = new Date();
    startPrimaryUser.setHours(startPrimaryUser.getHours() + 6);
    await generateAppointment({ userId: primaryUser.id, memberId, start: startPrimaryUser });

    const startUser1 = new Date();
    startUser1.setHours(startUser1.getHours() + 4);
    const appointment = await generateAppointment({
      userId: user1.id,
      memberId,
      start: startUser1,
    });

    const startUser2 = new Date();
    startUser2.setHours(startUser2.getHours() + 8);
    await generateAppointment({ userId: user2.id, memberId, start: startUser2 });

    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment.start,
        appointmentsCount: 3,
      }),
    );
  });

  it('should handle just users appointments in nextAppointment calculations', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const user1 = await creators.createAndValidateUser();
    const user2 = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: memberId } = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [user1, user2, primaryUser],
    });

    const start = new Date();
    start.setHours(start.getHours() + 4);
    const appointment = await generateAppointment({
      userId: user1.id,
      memberId,
      start,
    });

    const membersResult = await handler.queries.getMembers(org.id);

    expect(membersResult.length).toEqual(1);
    expect(membersResult[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should not take longer than 1 second to process 10 members with 3 appointments each', async () => {
    /* eslint-enable max-len*/
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    for (let i = 0; i < 10; i++) {
      const member = await creators.createAndValidateMember({
        org,
        primaryUser,
        users: [primaryUser],
      });
      await generateAppointment({ userId: primaryUser.id, memberId: member.id });
      await generateAppointment({ userId: primaryUser.id, memberId: member.id });
      await generateAppointment({ userId: primaryUser.id, memberId: member.id });
    }

    const membersResult = await handler.queries.getMembers(org.id);
    expect(membersResult.length).toEqual(10);
  }, 1000);

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const generateAppointment = async ({
    userId,
    memberId,
    start = date.future(1),
  }: {
    userId: string;
    memberId: string;
    start?: Date;
  }) => {
    const end = new Date(start.getTime() + 1000 * 60 * 60);

    const appointmentParams = generateScheduleAppointmentParams({
      memberId,
      userId,
      start,
      end,
    });

    return handler.mutations.scheduleAppointment({
      appointmentParams,
    });
  };
});
