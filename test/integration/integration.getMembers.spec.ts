import { Member, MemberSummary } from '../../src/member';
import { AppointmentsIntegrationActions } from '../aux';
import { Creators } from '../aux';
import { Handler } from '../aux';
import { User } from '../../src/user';

describe('Integration tests : getMembers', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    await creators.createFirstUserInDbfNecessary();
  });

  afterAll(async () => {
    await handler.afterAll();
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
          phoneType: member.phoneType,
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
    const member: Member = await creators.createAndValidateMember({ org, useNewUser: true });
    const primaryUser = member.users[0];

    await creators.createAndValidateAppointment({ member });
    const appointment = await appointmentsActions.scheduleAppointment({ member });
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createGoal);
    await creators.createAndValidateTask(member.id, handler.mutations.createActionItem);

    const memberResult = await handler
      .setContextUserId(member.id)
      .queries.getMember({ id: member.id });
    const { errors, members } = await handler.queries.getMembers(org.id);
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(members[0]).toEqual(
      expect.objectContaining({
        id: memberResult.id,
        name: `${memberResult.firstName} ${memberResult.lastName}`,
        phone: memberResult.phone,
        phoneType: member.phoneType,
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
});
