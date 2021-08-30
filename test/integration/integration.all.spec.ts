import {
  generateAppointmentLink,
  generateAvailabilityInput,
  generateCreateMemberParams,
  generateId,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
} from '../index';
import { UserRole } from '../../src/user';
import { AppointmentMethod, AppointmentStatus } from '../../src/appointment';
import { Handler } from './aux/handler';
import { AppointmentsIntegrationActions } from './aux/appointments';
import { Creators } from './aux/creators';
import { CreateTaskParams, MemberConfig, NotifyParams, Task, TaskStatus } from '../../src/member';
import {
  Errors,
  ErrorType,
  Identifiers,
  MobilePlatform,
  NotificationType,
  RegisterForNotificationParams,
} from '../../src/common';
import * as faker from 'faker';
import { v4 } from 'uuid';

describe('Integration tests: all', () => {
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

  it('should throw error if member is not found', async () => {
    await creators.handler.queries.getMember({
      invalidFieldsError: Errors.get(ErrorType.memberNotFound),
    });
  });

  it('should be able to call all gql handler.mutations and handler.queries', async () => {
    /**
     * 1. Create a user with a single role - coach
     * 2. Create a user with 2 roles - coach and nurse
     * 3. Create a user with 1 role - nurse
     * 4. Create an organization
     * 5. Create a member in the organization above with the 3 users above.
     *    1st user is the primaryUser, 2nd and 3rd users is in users list
     * 6. Create an appointment between the primary coach and the member
     * 7. Create an appointment between the non primary coach (2nd user) and the member
     * 8. Create an appointment between the non primary coach (3rd user) and the member
     * 9. Create goals for a member
     * 10. Update goals for a member
     * 11. Create action items for a member
     * 12. Update action items for a member
     * 13. Fetch member and checks all related appointments
     */
    const resultCoach = await creators.createAndValidateUser();
    const resultNurse1 = await creators.createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await creators.createAndValidateUser([UserRole.nurse]);

    const resultOrg = await creators.createAndValidateOrg();
    const resultMember = await creators.createAndValidateMember({
      org: resultOrg,
      primaryUser: resultCoach,
      users: [resultNurse1, resultNurse2, resultCoach],
    });

    const scheduledAppointmentPrimaryUser = await creators.createAndValidateAppointment({
      userId: resultCoach.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse1 = await creators.createAndValidateAppointment({
      userId: resultNurse1.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse2 = await creators.createAndValidateAppointment({
      userId: resultNurse2.id,
      member: resultMember,
    });

    const { createTaskParams: goal1, id: idGoal1 } = await creators.createAndValidateTask(
      resultMember.id,
      handler.mutations.createGoal,
    );
    const { createTaskParams: goal2, id: idGoal2 } = await creators.createAndValidateTask(
      resultMember.id,
      handler.mutations.createGoal,
    );
    await updateTaskStatus(idGoal1, handler.mutations.updateGoalStatus);
    await updateTaskStatus(idGoal2, handler.mutations.updateGoalStatus);

    const { createTaskParams: ai1, id: idAi1 } = await creators.createAndValidateTask(
      resultMember.id,
      handler.mutations.createActionItem,
    );
    const { createTaskParams: ai2, id: idAi2 } = await creators.createAndValidateTask(
      resultMember.id,
      handler.mutations.createActionItem,
    );
    await updateTaskStatus(idAi1, handler.mutations.updateActionItemStatus);
    await updateTaskStatus(idAi2, handler.mutations.updateActionItemStatus);

    const member = await handler.queries.getMember();

    expect(member.users.filter((user) => user.id === resultCoach.id)[0].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.done }),
    );
    expect(scheduledAppointmentPrimaryUser).toEqual(
      expect.objectContaining(
        member.users.filter((user) => user.id === resultCoach.id)[0].appointments[0],
      ),
    );

    expect(member.users[0].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.done }),
    );
    expect(scheduledAppointmentNurse1).toEqual(
      expect.objectContaining(member.users[0].appointments[0]),
    );

    expect(member.users[1].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.done }),
    );
    expect(scheduledAppointmentNurse2).toEqual(
      expect.objectContaining(member.users[1].appointments[0]),
    );
    expect(member.scores).toEqual(scheduledAppointmentNurse2.notes.scores);

    //Goals and action items are desc sorted, so the last inserted goal is the 1st in the list
    compareTasks(member.goals[0], goal2);
    compareTasks(member.goals[1], goal1);
    compareTasks(member.actionItems[0], ai2);
    compareTasks(member.actionItems[1], ai1);
  });

  /**
   * Checks that if a user has 2+ appointments with 2+ members,
   * when calling getMember it'll bring the specific member's appointment, and not all appointments
   * 1. user: { id: 'user-123' }
   * 2. member: { id: 'member-123', primaryUser: { id : 'user-123' } }
   * 3. member: { id: 'member-456', primaryUser: { id : 'user-123' } }
   * In this case, user has 2 appointments, but when a member requests an appointment,
   * it'll return just the related appointment of a user, and not all appointments.
   */
  it('getAppointments should return just the member appointment of a user', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member1 = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });
    const member2 = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const appointmentMember1 = await creators.createAndValidateAppointment({
      userId: primaryUser.id,
      member: member1,
    });

    const appointmentMember2 = await creators.createAndValidateAppointment({
      userId: primaryUser.id,
      member: member2,
    });

    const primaryUserWithAppointments = await handler.queries.getUser(primaryUser.id);
    expect(appointmentMember1).toEqual(
      expect.objectContaining(primaryUserWithAppointments.appointments[0]),
    );
    expect(appointmentMember2).toEqual(
      expect.objectContaining(primaryUserWithAppointments.appointments[1]),
    );

    handler.setContextUser(member1.deviceId);
    const memberResult1 = await handler.queries.getMember();
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.users[0].appointments[0]),
    );

    handler.setContextUser(member2.deviceId);
    const memberResult2 = await handler.queries.getMember();
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.users[0].appointments[0]),
    );
  });

  it('should update a member fields', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const updateMemberParams = generateUpdateMemberParams({ id: member.id });
    const updatedMemberResult = await handler.mutations.updateMember({ updateMemberParams });

    handler.setContextUser(member.deviceId);
    const memberResult = await handler.queries.getMember();

    expect(memberResult).toEqual(expect.objectContaining(updatedMemberResult));
  });

  it('should return org zip code if member does not have one', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const memberParams = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });

    delete memberParams.zipCode;

    await creators.handler.mutations.createMember({ memberParams });

    creators.handler.setContextUser(memberParams.deviceId);
    const member = await creators.handler.queries.getMember();
    expect(member.zipCode).toEqual(org.zipCode);
  });

  it('should calculate utcDelta if zipCode exists', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const memberParams = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });

    await creators.handler.mutations.createMember({ memberParams });

    creators.handler.setContextUser(memberParams.deviceId);
    const member = await creators.handler.queries.getMember();
    expect(member.utcDelta).toBeLessThan(0);
  });

  it('should set and get availability for users', async () => {
    await createAndValidateAvailabilities(2);
    await createAndValidateAvailabilities(5);
  });

  it('should be able to delete an availability', async () => {
    const { ids } = await createAndValidateAvailabilities(1);
    await handler.mutations.deleteAvailability({ id: ids[0] });
  });

  it('should throw error on delete a non existing availability', async () => {
    await handler.mutations.deleteAvailability({
      id: generateId(),
      invalidFieldsErrors: [Errors.get(ErrorType.availabilityNotFound)],
    });
  });

  it('should return members appointment filtered by orgId', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const mParams1 = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });
    const mParams2 = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });
    const { id: memberId1 } = await creators.handler.mutations.createMember({
      memberParams: mParams1,
    });
    const { id: memberId2 } = await creators.handler.mutations.createMember({
      memberParams: mParams2,
    });

    const params1a = generateScheduleAppointmentParams({
      memberId: memberId1,
      userId: primaryUser.id,
    });
    const params1b = generateScheduleAppointmentParams({
      memberId: memberId1,
      userId: primaryUser.id,
    });
    const params2a = generateScheduleAppointmentParams({
      memberId: memberId2,
      userId: primaryUser.id,
    });
    // Request appointment should not be on results, only showing status scheduled
    const params2b = generateRequestAppointmentParams({
      memberId: memberId2,
      userId: primaryUser.id,
    });

    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params1a });
    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params1b });
    await creators.handler.mutations.scheduleAppointment({ appointmentParams: params2a });
    await creators.handler.mutations.requestAppointment({ appointmentParams: params2b });

    const result = await creators.handler.queries.getMembersAppointments(org.id);
    expect(result.length).toEqual(2);

    expect(result).toEqual(
      expect.arrayContaining([
        {
          memberId: memberId1,
          memberName: `${mParams1.firstName} ${mParams1.lastName}`,
          userId: primaryUser.id,
          userName: `${primaryUser.firstName} ${primaryUser.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
        },
        {
          memberId: memberId2,
          memberName: `${mParams2.firstName} ${mParams2.lastName}`,
          userId: primaryUser.id,
          userName: `${primaryUser.firstName} ${primaryUser.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
        },
      ]),
    );
  });

  it('should override requested appointment when calling schedule appointment', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const memberParams = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });
    const { id: memberId } = await creators.handler.mutations.createMember({
      memberParams,
    });

    const requestedAppointment = generateRequestAppointmentParams({
      memberId,
      userId: primaryUser.id,
    });
    const { id: requestedId } = await creators.handler.mutations.requestAppointment({
      appointmentParams: requestedAppointment,
    });

    const scheduledAppointment = generateScheduleAppointmentParams({
      memberId,
      userId: primaryUser.id,
    });
    const { id: scheduledId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment,
    });

    expect(requestedId).toEqual(scheduledId);
    const result = await creators.handler.queries.getAppointment(scheduledId);
    expect(new Date(result.end)).toEqual(scheduledAppointment.end);
    expect(new Date(result.start)).toEqual(scheduledAppointment.start);
  });

  it('should override scheduled appointment when calling schedule appointment', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();

    const memberParams = generateCreateMemberParams({
      orgId: org.id,
      primaryUserId: primaryUser.id,
      usersIds: [primaryUser.id],
    });
    const { id: memberId } = await creators.handler.mutations.createMember({
      memberParams,
    });

    const scheduledAppointment1 = generateScheduleAppointmentParams({
      memberId,
      userId: primaryUser.id,
      method: AppointmentMethod.chat,
    });
    const { id: requestedId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment1,
    });

    const scheduledAppointment2 = generateScheduleAppointmentParams({
      memberId,
      userId: primaryUser.id,
      method: AppointmentMethod.videoCall,
    });
    const { id: scheduledId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment2,
    });

    expect(requestedId).toEqual(scheduledId);
    const result = await creators.handler.queries.getAppointment(scheduledId);
    expect(new Date(result.end)).toEqual(scheduledAppointment2.end);
    expect(new Date(result.start)).toEqual(scheduledAppointment2.start);
    expect(result.method).toEqual(scheduledAppointment2.method);
  });

  it('should validate that getMember attach chat app link to each appointment', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const appointmentMember = await creators.createAndValidateAppointment({
      userId: primaryUser.id,
      member,
    });

    handler.setContextUser(member.deviceId);
    const memberResult = await handler.queries.getMember();
    expect(appointmentMember).toEqual(
      expect.objectContaining({
        link: generateAppointmentLink(memberResult.users[0].appointments[0].id),
      }),
    );
  });

  it('web: should be able to getMember with member id', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult).toEqual(expect.objectContaining({ ...member }));
  });

  it('should be able to set note for a member', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);
  });

  it('should be able to set null note for a member', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    let memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);

    delete setGeneralNotesParams.note;
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toBeNull();
  });

  it('should be able to get dispatch links of a member', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const { id } = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const result = await handler.queries.getMemberDischargeDocumentsLinks({ id });
    expect(result).toEqual({
      dischargeNotesLink: 'https://some-url',
      dischargeInstructionsLink: 'https://some-url',
    });
  });

  test.each`
    register
    ${{ mobilePlatform: MobilePlatform.ios, token: faker.lorem.word() }}
    ${{ mobilePlatform: MobilePlatform.android }}
  `(
    /* eslint-enable max-len */
    `should registerMemberForNotifications and update MemberConfig on $register.mobilePlatform`,
    async (params) => {
      const primaryUser = await creators.createAndValidateUser();
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({
        org,
        primaryUser,
        users: [primaryUser],
      });

      const memberConfigDefault: MemberConfig = await handler.queries.getMemberConfig({ id });
      expect(memberConfigDefault).toEqual({
        memberId: id,
        externalUserId: expect.any(String),
        mobilePlatform: null,
      });

      const registerForNotificationParams: RegisterForNotificationParams = {
        memberId: id,
        ...params.register,
      };
      await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

      if (params.register.mobilePlatform === MobilePlatform.ios) {
        expect(handler.notificationsService.spyOnNotificationsServiceRegister).toBeCalledWith({
          token: registerForNotificationParams.token,
          externalUserId: memberConfigDefault.externalUserId,
        });
      } else {
        expect(handler.notificationsService.spyOnNotificationsServiceRegister).not.toBeCalled();
      }

      const newMemberConfig: MemberConfig = await handler.queries.getMemberConfig({ id });
      expect(newMemberConfig).toEqual({
        memberId: id,
        externalUserId: expect.any(String),
        mobilePlatform: params.register.mobilePlatform,
      });

      handler.notificationsService.spyOnNotificationsServiceRegister.mockReset();
    },
  );

  it('should send a notification', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const { id } = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const memberConfig = await handler.queries.getMemberConfig({ id });

    const notifyParams: NotifyParams = {
      memberId: id,
      userId: primaryUser.id,
      type: NotificationType.video,
      peerId: v4(),
    };
    await handler.mutations.notify({ notifyParams });

    expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
      externalUserId: memberConfig.externalUserId,
      payload: { heading: { en: 'Laguna' } },
      data: {
        user: {
          id: primaryUser.id,
          firstName: primaryUser.firstName,
          avatar: primaryUser.avatar,
        },
        type: notifyParams.type,
        peerId: notifyParams.peerId,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });

  it('should get communication with the same user and member id that were given', async () => {
    const primaryUser = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const result = await handler.queries.getCommunication({
      getCommunicationParams: { memberId: member.id, userId: primaryUser.id },
    });

    expect(result.memberId).toEqual(member.id);
    expect(result.userId).toEqual(primaryUser.id);
    expect(result).toHaveProperty('chat');
  });

  it('should get all users and a newly created user should be in the list', async () => {
    const newUser = await creators.createAndValidateUser();

    const result = await handler.queries.getUsers();
    expect(
      result.some((user) => {
        return newUser.id == user.id;
      }),
    ).toEqual(true);
  });

  it('should get twilio token', async () => {
    const result = await handler.queries.getTwilioAccessToken();

    expect(result).toEqual('token');
  });

  /* eslint-disable max-len */
  test.each`
    title                    | method
    ${'requestAppointment'}  | ${async ({ memberId, userId }) => await handler.mutations.requestAppointment({ appointmentParams: generateRequestAppointmentParams({ memberId, userId }) })}
    ${'scheduleAppointment'} | ${async ({ memberId, userId }) => await handler.mutations.scheduleAppointment({ appointmentParams: generateScheduleAppointmentParams({ memberId, userId }) })}
  `(`should add a not existed user to member users list on $title`, async (params) => {
    /* eslint-enable max-len */
    const primaryUser = await creators.createAndValidateUser();
    const user = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({
      org,
      primaryUser,
      users: [primaryUser],
    });

    const initialMember = await handler.queries.getMember({ id: member.id });
    expect(initialMember.users.length).toEqual(1);
    expect(initialMember.users[0].id).toEqual(primaryUser.id);

    //calling twice, to check that the user wasn't added twice to users list
    await params.method({ userId: user.id, memberId: member.id });
    await params.method({ userId: user.id, memberId: member.id });

    const { users } = await handler.queries.getMember({ id: member.id });

    const ids = users.map((user) => user.id);
    expect(ids.length).toEqual(2);
    expect(ids[0]).toEqual(primaryUser.id);
    expect(ids[1]).toEqual(user.id);
  });

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const updateTaskStatus = async (id: string, method) => {
    const updateTaskStatusParams = { id, status: TaskStatus.reached };
    await method({ updateTaskStatusParams });
  };

  const compareTasks = (task: Task, createTaskParams: CreateTaskParams) => {
    expect(task.title).toEqual(createTaskParams.title);
    expect(task.status).toEqual(TaskStatus.reached);
    expect(new Date(task.deadline)).toEqual(createTaskParams.deadline);
  };

  const createAndValidateAvailabilities = async (count: number): Promise<Identifiers> => {
    const { id: userId } = await creators.createAndValidateUser();

    const availabilities = Array.from(Array(count)).map(() =>
      generateAvailabilityInput({ userId }),
    );

    const { ids } = await handler.mutations.createAvailabilities({
      availabilities,
    });

    expect(ids.length).toEqual(availabilities.length);

    const availabilitiesResult = await handler.queries.getAvailabilities();
    const resultFiltered = availabilitiesResult.filter(
      (availability) => availability.userId === userId,
    );

    expect(resultFiltered.length).toEqual(availabilities.length);

    return { ids };
  };
});
