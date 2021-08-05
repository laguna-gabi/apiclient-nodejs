import { generateObjectId, generateScheduleAppointmentParams } from '../index';
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
    const membersResult = await handler.queries.getMembers(generateObjectId().toString());
    expect(membersResult.length).toEqual(0);
  });

  it('should return nothing for no members on org', async () => {
    const org = await creators.createAndValidateOrg();
    const membersResult = await handler.queries.getMembers(org.id);
    expect(membersResult.length).toEqual(0);
  });

  it('should call with a default member(no: appointments, goals, ai, ..)', async () => {
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member1: Member = await creators.createAndValidateMember({ org, primaryCoach });
    const member2: Member = await creators.createAndValidateMember({ org, primaryCoach });

    const membersResult = await handler.queries.getMembers(org.id);

    const compareResults = (result: MemberSummary, member: Member) => {
      expect(result).toEqual(
        expect.objectContaining({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          phoneNumber: member.phoneNumber,
          dischargeDate: member.dischargeDate,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          goalsCount: 0,
          actionItemsCount: 0,
          primaryCoach: expect.objectContaining({ avatar: primaryCoach.avatar }),
          nextAppointment: null,
          appointmentsCount: 0,
        }),
      );
    };

    expect(membersResult.length).toEqual(2);
    compareResults(membersResult[0], member1);
    compareResults(membersResult[1], member2);
  });

  it('should call with a all member parameters', async () => {
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org, primaryCoach });
    await creators.createAndValidateAppointment({ userId: primaryCoach.id, member });
    const appointment = await appointmentsActions.scheduleAppointment(primaryCoach.id, member);
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
        phoneNumber: memberResult.phoneNumber,
        dischargeDate: memberResult.dischargeDate,
        adherence: memberResult.scores.adherence,
        wellbeing: memberResult.scores.wellbeing,
        createdAt: memberResult.createdAt,
        goalsCount: 2,
        actionItemsCount: 1,
        primaryCoach: expect.objectContaining({ avatar: primaryCoach.avatar }),
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  it('should call having a single scheduled appointment', async () => {
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org, primaryCoach });
    const appointment = await appointmentsActions.scheduleAppointment(primaryCoach.id, member);

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
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org, primaryCoach });
    await appointmentsActions.requestAppointment(primaryCoach.id, member);
    const appointment = await appointmentsActions.scheduleAppointment(primaryCoach.id, member);
    await appointmentsActions.endAppointment(appointment.id);

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
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: userId } = primaryCoach;
    const { id: memberId }: Member = await creators.createAndValidateMember({ org, primaryCoach });

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
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: userId } = primaryCoach;
    const { id: memberId } = await creators.createAndValidateMember({ org, primaryCoach });

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
    const primaryCoach = await creators.createAndValidateUser();
    const user1 = await creators.createAndValidateUser();
    const user2 = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: memberId } = await creators.createAndValidateMember({
      org,
      primaryCoach,
      coaches: [user1, user2],
    });

    let startPrimaryCoach = new Date();
    startPrimaryCoach.setHours(startPrimaryCoach.getHours() + 10);
    await generateAppointment({ userId: primaryCoach.id, memberId, start: startPrimaryCoach });
    startPrimaryCoach = new Date();
    startPrimaryCoach.setHours(startPrimaryCoach.getHours() + 6);
    await generateAppointment({ userId: primaryCoach.id, memberId, start: startPrimaryCoach });

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
    const primaryCoach = await creators.createAndValidateUser();
    const user1 = await creators.createAndValidateUser();
    const user2 = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const { id: memberId } = await creators.createAndValidateMember({
      org,
      primaryCoach,
      coaches: [user1, user2],
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
    const primaryCoach = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    for (let i = 0; i < 10; i++) {
      const member = await creators.createAndValidateMember({ org, primaryCoach });
      await generateAppointment({ userId: primaryCoach.id, memberId: member.id });
      await generateAppointment({ userId: primaryCoach.id, memberId: member.id });
      await generateAppointment({ userId: primaryCoach.id, memberId: member.id });
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
