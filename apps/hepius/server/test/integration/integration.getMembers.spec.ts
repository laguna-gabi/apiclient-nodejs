import { User } from '@argus/hepiusClient';
import { Platform } from '@argus/pandora';
import { BEFORE_ALL_TIMEOUT, generateChangeMemberDnaParams, generateRequestHeaders } from '..';
import { ChangeType, RegisterForNotificationParams } from '../../src/common';
import { Member, MemberConfig, MemberSummary } from '../../src/member';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';

describe('Integration tests : getMembers', () => {
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

  it('should call with a default member(no: appointments, ai, ..)', async () => {
    const { member: member1, org } = await creators.createMemberUserAndOptionalOrg();
    const { member: member2 } = await creators.createMemberUserAndOptionalOrg({ orgId: org.id });
    const primaryUser1 = member1.users[0];
    const primaryUser2 = member2.users[0];
    const memberConfig1 = await handler.queries.getMemberConfig({ id: member1.id });
    const memberConfig2 = await handler.queries.getMemberConfig({ id: member2.id });

    const membersResult = await handler.queries.getMembers({
      orgIds: [org.id],
    });

    const compareResults = (
      result: MemberSummary,
      member: Member,
      memberConfig: MemberConfig,
      primaryUser: User,
    ) => {
      expect(result).toEqual(
        expect.objectContaining({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          phone: member.phone,
          phoneType: member.phoneType,
          adherence: 0,
          wellbeing: 0,
          createdAt: member.createdAt,
          actionItemsCount: 0,
          primaryUser: expect.objectContaining({
            id: primaryUser.id,
            firstName: primaryUser.firstName,
            lastName: primaryUser.lastName,
            avatar: primaryUser.avatar,
          }),
          nextAppointment: null,
          appointmentsCount: 0,
          firstLoggedInAt: null,
          platform: memberConfig.platform,
        }),
      );
    };

    expect(membersResult.members.length).toEqual(2);
    compareResults(membersResult.members[0], member1, memberConfig1, primaryUser1);
    compareResults(membersResult.members[1], member2, memberConfig2, primaryUser2);
  });

  it('should call with a all member parameters', async () => {
    const { member, org } = await creators.createMemberUserAndOptionalOrg();
    const primaryUser = member.users[0];
    const registerForNotificationParams: RegisterForNotificationParams = {
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({
      registerForNotificationParams,
      requestHeaders: generateRequestHeaders(member.authId),
    });
    const journey = await handler.journeyService.getRecent(member.id);

    await creators.createAndValidateAppointment({ member });
    const appointment = await appointmentsActions.scheduleAppointment({ member });
    await creators.createAndValidateActionItem(member.id);
    await creators.createAndValidateActionItem(member.id);

    const requestHeaders = generateRequestHeaders(member.authId);
    const memberResult = await handler.queries.getMember({
      id: member.id,
      requestHeaders,
    });
    const { errors, members } = await handler.queries.getMembers({ orgIds: [org.id] });
    expect(errors).toEqual(undefined);
    expect(members.length).toEqual(1);
    expect(Date.parse(members[0].firstLoggedInAt)).toEqual(journey.firstLoggedInAt.getTime());
    expect(members[0]).toEqual(
      expect.objectContaining({
        id: memberResult.id,
        name: `${memberResult.firstName} ${memberResult.lastName}`,
        phone: memberResult.phone,
        phoneType: member.phoneType,
        createdAt: memberResult.createdAt,
        actionItemsCount: 2,
        primaryUser: expect.objectContaining({
          id: primaryUser.id,
          firstName: primaryUser.firstName,
          lastName: primaryUser.lastName,
          avatar: primaryUser.avatar,
        }),
        nextAppointment: appointment.start,
        appointmentsCount: 2,
        platform: registerForNotificationParams.platform,
      }),
    );
  });

  it('should display recent journey results having multiple journeys per member', async () => {
    const { member, org } = await creators.createMemberUserAndOptionalOrg();
    const recentJourney = await handler.journeyService.create({
      memberId: member.id,
      orgId: org.id,
    });

    await handler.mutations.registerMemberForNotifications({
      registerForNotificationParams: {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      },
      requestHeaders: generateRequestHeaders(member.authId),
    });

    const appointment = await creators.createAndValidateAppointment({ member });
    const membersResult = await handler.queries.getMembers({ orgIds: [org.id] });

    const journey = await handler.queries.getRecentJourney({ memberId: member.id });
    expect(journey.scores.adherence).toBeGreaterThanOrEqual(1);
    expect(journey.scores.wellbeing).toBeGreaterThanOrEqual(1);
    expect(journey.id).toEqual(recentJourney.id.toString());
    expect(appointment.notes.scores).toEqual(journey.scores);

    expect(membersResult.members.length).toEqual(1);
    expect(membersResult.members[0]).toEqual(
      expect.objectContaining({
        id: member.id,
        firstLoggedInAt: journey.firstLoggedInAt,
        isGraduated: journey.isGraduated,
        graduationDate: journey.graduationDate,
        adherence: journey.scores.adherence,
        wellbeing: journey.scores.wellbeing,
      }),
    );
  });

  it('should display recent journey results with admissions data', async () => {
    const { member, org } = await creators.createMemberUserAndOptionalOrg();
    const changeMemberDnaParams = generateChangeMemberDnaParams({
      changeType: ChangeType.create,
      memberId: member.id,
    });
    delete changeMemberDnaParams.admitSource;
    await handler.mutations.changeMemberDna({ changeMemberDnaParams });

    const membersResult = await handler.queries.getMembers({ orgIds: [org.id] });

    expect(membersResult.members.length).toEqual(1);
    expect(membersResult.members[0]).toEqual(
      expect.objectContaining({
        id: member.id,
        dischargeDate: changeMemberDnaParams.dischargeDate,
      }),
    );
  });
});
