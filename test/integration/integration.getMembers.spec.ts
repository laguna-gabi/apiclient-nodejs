import { date } from 'faker';
import { performance } from 'perf_hooks';
import { Member, MemberSummary } from '../../src/member';
import { AppointmentsIntegrationActions } from '../aux/appointments';
import { Creators } from '../aux/creators';
import { Handler } from '../aux/handler';
import { generateId, generateScheduleAppointmentParams } from '../index';
import { User } from '../../src/user';

describe('Integration tests : getMembers', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    handler.mockCommunication();
    await creators.createFirstUserInDbfNecessary();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('should return nothing for none existing org', async () => {
    const { errors, members } = await handler.queries.getMembers(generateId());
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(0);
  });

  it('should return nothing for no members on org', async () => {
    const org = await creators.createAndValidateOrg();
    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(0);
  });

  it('should call with a default member(no: appointments, goals, ai, ..)', async () => {
    const org = await creators.createAndValidateOrg();
    const member1: Member = await creators.createAndValidateMember({ org });
    const member2: Member = await creators.createAndValidateMember({ org });
    const primaryUser1 = member1.users[0];
    const primaryUser2 = member2.users[0];

    const membersResult = await handler.queries.getMembers(org.id);

    const compareResults = (result: MemberSummary, member: Member, primaryUser: User) => {
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

    expect(membersResult.members.length).toEqual(2);
    compareResults(membersResult.members[0], member1, primaryUser1);
    compareResults(membersResult.members[1], member2, primaryUser2);
  });

  it('should call with a all member parameters', async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    const primaryUser = member.users[0];

    await creators.createAndValidateAppointment({ member });
    const appointment = await appointmentsActions.scheduleAppointment({ member });
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createActionItem);

    const memberResult = await handler.queries.getMember({ id: member.id });
    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
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
        appointmentsCount: 2,
      }),
    );
  });

  it('should call having a single scheduled appointment', async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    const appointment = await appointmentsActions.scheduleAppointment({ member });

    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        id: member.id,
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  it('should return no nextAppointment on no scheduled appointments', async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    await appointmentsActions.requestAppointment({ member });
    const appointment = await appointmentsActions.scheduleAppointment({ member });
    await handler.mutations.endAppointment({ endAppointmentParams: { id: appointment.id } });

    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        nextAppointment: null,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should return most recent scheduled appointment (start time) when it was scheduled before', async () => {
    await generate2Appointments(1);
  });

  /* eslint-disable max-len*/
  it('should return most recent scheduled appointment (start time) when it was scheduled after', async () => {
    /* eslint-enable max-len*/
    await generate2Appointments(-1);
  });

  const generate2Appointments = async (secondAppointmentGap: number) => {
    const org = await creators.createAndValidateOrg();

    const member: Member = await creators.createAndValidateMember({ org });

    const start1 = new Date();
    start1.setHours(start1.getHours() + 2);
    const appointment1 = await generateAppointment({ member, start: start1 });
    const start2 = new Date();
    start2.setHours(start1.getHours() + secondAppointmentGap);
    const appointment2 = await generateAppointment({ member, start: start2 });

    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(appointment1.id).not.toEqual(appointment2.id);

    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        nextAppointment: secondAppointmentGap > 0 ? appointment1.start : appointment2.start,
        appointmentsCount: 2,
      }),
    );
  };

  /* eslint-disable max-len*/
  it('should handle primaryUser and users appointments in nextAppointment calculations', async () => {
    /* eslint-enable max-len*/
    const user1 = await creators.createAndValidateUser();
    const user2 = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const member = await creators.createAndValidateMember({ org });

    await creators.createAndValidateAppointment({ member });

    let startPrimaryUser = new Date();
    startPrimaryUser.setHours(startPrimaryUser.getHours() + 10);
    await generateAppointment({ userId: user1.id, member, start: startPrimaryUser });
    startPrimaryUser = new Date();
    startPrimaryUser.setHours(startPrimaryUser.getHours() + 6);
    await generateAppointment({ userId: user2.id, member, start: startPrimaryUser });

    const startUser1 = new Date();
    startUser1.setHours(startUser1.getHours() + 4);
    const appointment = await generateAppointment({
      userId: user1.id,
      member,
      start: startUser1,
    });

    const startUser2 = new Date();
    startUser2.setHours(startUser2.getHours() + 8);
    await generateAppointment({ userId: user2.id, member, start: startUser2 });

    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment.start,
        appointmentsCount: 5,
      }),
    );
  });

  it('should handle just users appointments in nextAppointment calculations', async () => {
    const user = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const member = await creators.createAndValidateMember({ org });

    const start = new Date();
    start.setHours(start.getHours() + 4);
    const appointment = await generateAppointment({ userId: user.id, member, start });

    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        nextAppointment: appointment.start,
        appointmentsCount: 1,
      }),
    );
  });

  /* eslint-disable max-len*/
  it('should not take longer than 1 second to process 10 members with 3 appointments each', async () => {
    /* eslint-enable max-len*/
    const org = await creators.createAndValidateOrg();

    for (let i = 0; i < 10; i++) {
      const member = await creators.createAndValidateMember({ org });
      await generateAppointment({ member });
      await generateAppointment({ member });
      await generateAppointment({ member });
    }

    const startTime = performance.now();
    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    const endTime = performance.now();
    expect(members.length).toEqual(10);
    expect(endTime - startTime).toBeLessThan(1000);
  }, 15000);

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const generateAppointment = async ({
    member,
    userId,
    start = date.future(1),
  }: {
    member: Member;
    userId?: string;
    start?: Date;
  }) => {
    const end = new Date(start.getTime() + 1000 * 60 * 60);

    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: userId || member.primaryUserId,
      start,
      end,
    });

    return handler.mutations.scheduleAppointment({
      appointmentParams,
    });
  };
});
