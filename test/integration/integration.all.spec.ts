import {
  CancelNotificationType,
  InternalNotificationType,
  NotificationType,
  Platform,
} from '@lagunahealth/pandora';
import * as config from 'config';
import { add, addDays, startOfToday, startOfTomorrow } from 'date-fns';
import * as faker from 'faker';
import { v4 } from 'uuid';
import {
  Appointment,
  AppointmentMethod,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
} from '../../src/appointment';
import {
  ErrorType,
  Errors,
  Identifiers,
  RegisterForNotificationParams,
  UserRole,
  delay,
} from '../../src/common';
import {
  DailyReportCategoriesInput,
  DailyReportCategoryTypes,
  DailyReportQueryInput,
} from '../../src/dailyReport';
import {
  CancelNotifyParams,
  CreateTaskParams,
  Member,
  NotifyParams,
  RecordingOutput,
  ReplaceUserForMemberParams,
  Task,
  TaskStatus,
  UpdateJournalTextParams,
  UpdateRecordingParams,
} from '../../src/member';
import { User, defaultSlotsParams } from '../../src/user';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import {
  generateAppointmentLink,
  generateAvailabilityInput,
  generateCancelNotifyParams,
  generateId,
  generateOrgParams,
  generatePath,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateNotesParams,
  generateUpdateRecordingParams,
} from '../index';
import { iceServers } from '../unit/mocks/twilioPeerIceServers';

describe('Integration tests: all', () => {
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

  it('should be able to call all gql mutations and queries', async () => {
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
    const resultNurse1 = await creators.createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await creators.createAndValidateUser([UserRole.nurse]);

    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org, useNewUser: true });

    const appointmentPrimaryUser = await creators.createAndValidateAppointment({ member });

    const appointmentNurse1 = await creators.createAndValidateAppointment({
      member,
      userId: resultNurse1.id,
    });

    const appointmentNurse2 = await creators.createAndValidateAppointment({
      member,
      userId: resultNurse2.id,
    });

    const { createTaskParams: goal1, id: idGoal1 } = await creators.createAndValidateTask(
      member.id,
      handler.mutations.createGoal,
    );
    const { createTaskParams: goal2, id: idGoal2 } = await creators.createAndValidateTask(
      member.id,
      handler.mutations.createGoal,
    );
    await updateTaskStatus(idGoal1, handler.mutations.updateGoalStatus);
    await updateTaskStatus(idGoal2, handler.mutations.updateGoalStatus);

    const { createTaskParams: ai1, id: idAi1 } = await creators.createAndValidateTask(
      member.id,
      handler.mutations.createActionItem,
    );
    const { createTaskParams: ai2, id: idAi2 } = await creators.createAndValidateTask(
      member.id,
      handler.mutations.createActionItem,
    );
    await updateTaskStatus(idAi1, handler.mutations.updateActionItemStatus);
    await updateTaskStatus(idAi2, handler.mutations.updateActionItemStatus);

    const resultMember = await handler
      .setContextUserId(member.id)
      .queries.getMember({ id: member.id });

    const compareAppointmentsOfUsers = (receivedAppointment: Appointment, users: User[]) => {
      const all = users.reduce((prev, next) => prev.concat(next.appointments), []);
      const appointment = all.find((appointment) => appointment.id === receivedAppointment.id);
      expect(appointment).not.toBeUndefined();
      expect(receivedAppointment).toEqual(expect.objectContaining(appointment));
    };

    compareAppointmentsOfUsers(appointmentNurse1, resultMember.users);
    compareAppointmentsOfUsers(appointmentNurse2, resultMember.users);
    compareAppointmentsOfUsers(appointmentPrimaryUser, resultMember.users);

    expect(resultMember.scores).toEqual(appointmentNurse2.notes.scores);

    //Goals and action items are desc sorted, so the last inserted goal is the 1st in the list
    compareTasks(resultMember.goals[0], goal2);
    compareTasks(resultMember.goals[1], goal1);
    compareTasks(resultMember.actionItems[0], ai2);
    compareTasks(resultMember.actionItems[1], ai1);
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
  it('get should return just the member appointment of a user', async () => {
    const org = await creators.createAndValidateOrg();
    const member1 = await creators.createAndValidateMember({ org, useNewUser: true });
    const member2 = await creators.createAndValidateMember({ org, useNewUser: true });

    const appointmentMember1 = await creators.createAndValidateAppointment({ member: member1 });
    const appointmentMember2 = await creators.createAndValidateAppointment({ member: member2 });

    const memberResult1 = await handler
      .setContextUserId(member1.id)
      .queries.getMember({ id: member1.id });
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.users[0].appointments[0]),
    );

    const memberResult2 = await handler
      .setContextUserId(member2.id)
      .queries.getMember({ id: member2.id });
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.users[0].appointments[0]),
    );
  });

  it('should successfully create an org and then get it by id', async () => {
    const orgParams = generateOrgParams();
    const { id } = await handler.mutations.createOrg({ orgParams });
    const createdOrg = await handler.queries.getOrg({ id });

    expect(createdOrg).toEqual(expect.objectContaining({ ...orgParams, id }));
  });

  it('should return members appointment filtered by orgId', async () => {
    const org = await creators.createAndValidateOrg();
    const member1 = await creators.createAndValidateMember({ org, useNewUser: true });
    const primaryUser1 = member1.users[0];
    const member2 = await creators.createAndValidateMember({ org, useNewUser: true });
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

    const result = await creators.handler.queries.getMembersAppointments(org.id);
    const resultMember1 = await creators.handler
      .setContextUserId(member1.id)
      .queries.getMember({ id: member1.id });
    const resultMember2 = await creators.handler
      .setContextUserId(member2.id)
      .queries.getMember({ id: member2.id });

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
        },
        {
          memberId: member1.id,
          memberName: `${resultMember1.firstName} ${resultMember1.lastName}`,
          userId: primaryUser1.id,
          userName: `${primaryUser1.firstName} ${primaryUser1.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
        },
        {
          memberId: member2.id,
          memberName: `${resultMember2.firstName} ${resultMember2.lastName}`,
          userId: primaryUser2.id,
          userName: `${primaryUser2.firstName} ${primaryUser2.lastName}`,
          start: expect.any(String),
          end: expect.any(String),
        },
      ]),
    );
  });

  it('should validate that getMember attach chat app link to each appointment', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org, useNewUser: true });

    const appointmentMember = await creators.createAndValidateAppointment({ member });

    const memberResult = await handler
      .setContextUserId(member.id)
      .queries.getMember({ id: member.id });
    expect(appointmentMember).toEqual(
      expect.objectContaining({
        link: generateAppointmentLink(memberResult.users[0].appointments[0].id),
      }),
    );
  });

  it('should update and get member configs', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const memberConfigBefore = await handler
      .setContextUserId(member.id)
      .queries.getMemberConfig({ id: member.id });
    expect(memberConfigBefore).toEqual({
      memberId: member.id,
      articlesPath: config.get('articlesByDrg.default'),
      externalUserId: expect.any(String),
      firstLoggedInAt: null,
      platform: Platform.web,
      isPushNotificationsEnabled: true,
      isAppointmentsReminderEnabled: true,
      isRecommendationsEnabled: true,
    });

    const updateMemberConfigParams = generateUpdateMemberConfigParams();
    delete updateMemberConfigParams.memberId;
    await handler
      .setContextUserId(member.id)
      .mutations.updateMemberConfig({ updateMemberConfigParams });
    const memberConfigAfter = await handler
      .setContextUserId(member.id)
      .queries.getMemberConfig({ id: member.id });

    expect(memberConfigAfter).toEqual({
      memberId: member.id,
      externalUserId: memberConfigBefore.externalUserId,
      firstLoggedInAt: null,
      articlesPath: memberConfigBefore.articlesPath,
      platform: Platform.web,
      isPushNotificationsEnabled: updateMemberConfigParams.isPushNotificationsEnabled,
      isAppointmentsReminderEnabled: updateMemberConfigParams.isAppointmentsReminderEnabled,
      isRecommendationsEnabled: updateMemberConfigParams.isRecommendationsEnabled,
    });
  });

  it(`should send a future notification`, async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });
    const primaryUser = member.users[0];

    await delay(1000);
    /**
     * reset mock on NotificationsService so we dont count
     * the notifications that are made on member creation
     */
    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();

    const registerForNotificationParams: RegisterForNotificationParams = {
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler
      .setContextUserId(member.id)
      .mutations.registerMemberForNotifications({ registerForNotificationParams });
    const memberConfig = await handler
      .setContextUserId(member.id)
      .queries.getMemberConfig({ id: member.id });

    const when = new Date();
    when.setSeconds(when.getSeconds() + 1);
    const notifyParams: NotifyParams = {
      memberId: member.id,
      userId: primaryUser.id,
      type: NotificationType.text,
      metadata: { content: faker.lorem.word(), when },
    };

    await handler.mutations.notify({ notifyParams });
    expect(handler.notificationsService.spyOnNotificationsServiceSend).not.toBeCalled();

    await delay(1500);
    delete notifyParams.metadata.when;
    expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
      sendOneSignalNotification: {
        externalUserId: memberConfig.externalUserId,
        platform: memberConfig.platform,
        data: {
          user: {
            id: primaryUser.id,
            firstName: primaryUser.firstName,
            avatar: primaryUser.avatar,
          },
          member: { phone: member.phone },
          type: InternalNotificationType.textToMember,
          isVideo: false,
        },
        content: notifyParams.metadata.content,
        orgName: org.name,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });

  /* eslint-disable max-len */
  test.each`
    title | method
    ${'requestAppointment'} | ${async ({ memberId, userId }) => await handler.mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  })}
    ${'scheduleAppointment'} | ${async ({ memberId, userId, start }) => await handler.mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
      start,
    }),
  })}
  `(`should add a not existed user to member users list on $title`, async (params) => {
    /* eslint-enable max-len */
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org, useNewUser: true });

    const initialMember = await handler
      .setContextUserId(member.id)
      .queries.getMember({ id: member.id });
    expect(initialMember.users.length).toEqual(1);
    expect(initialMember.users[0].id).toEqual(member.primaryUserId);

    const newUser = await creators.createAndValidateUser();
    //calling twice, to check that the user wasn't added twice to users list
    const appointment1 = await params.method({ userId: newUser.id, memberId: member.id });
    const start = new Date(appointment1.end);
    start.setHours(start.getHours() + 1);
    await params.method({
      userId: newUser.id,
      memberId: member.id,
      start,
    });

    const { users } = await handler
      .setContextUserId(member.id)
      .queries.getMember({ id: member.id });

    const ids = users.map((user) => user.id);
    expect(ids.length).toEqual(2);
    expect(ids[0]).toEqual(member.primaryUserId);
    expect(ids[1]).toEqual(newUser.id);
  });

  describe('new member + member registration scheduling', () => {
    it('should delete timeout for member if an appointment is scheduled', async () => {
      const primaryUser = await creators.createAndValidateUser();
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });
      const appointmentParams: RequestAppointmentParams = generateRequestAppointmentParams({
        memberId: member.id,
        userId: primaryUser.id,
      });
      const requestedAppointment = await handler.mutations.requestAppointment({
        appointmentParams,
      });
      const scheduleAppointmentParams: ScheduleAppointmentParams =
        generateScheduleAppointmentParams({
          memberId: member.id,
          userId: primaryUser.id,
          id: requestedAppointment.id,
        });
      await handler.mutations.scheduleAppointment({ appointmentParams: scheduleAppointmentParams });

      expect(handler.schedulerRegistry.getTimeouts()).not.toEqual(
        expect.arrayContaining([member.id]),
      );
    });
  });

  describe('archive member', () => {
    it('should archive member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const result = await handler.mutations.archiveMember({ id: member.id });
      expect(result).toBeTruthy();

      const memberResult = await handler
        .setContextUserId(member.id)
        .queries.getMember({ id: member.id });
      await expect(memberResult).toEqual({
        errors: [{ code: ErrorType.memberNotFound, message: Errors.get(ErrorType.memberNotFound) }],
      });
    });
  });

  describe('delete member', () => {
    it('should delete member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });
      const appointment = await creators.createAndValidateAppointment({ member });

      const result = await handler.mutations.deleteMember({ id: member.id });
      expect(result).toBeTruthy();
      await delay(500);

      const memberResult = await handler
        .setContextUserId(member.id)
        .queries.getMember({ id: member.id });
      await expect(memberResult).toEqual({
        errors: [{ code: ErrorType.memberNotFound, message: Errors.get(ErrorType.memberNotFound) }],
      });
      const appointmentReult = await handler.queries.getAppointment(appointment.id);
      expect(appointmentReult).toBeNull();
    });
  });

  describe('replaceUserForMember', () => {
    it('should set new user for a given member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });
      const oldUserId = member.primaryUserId.toString();
      const newUser = await creators.createAndValidateUser();
      delete newUser.authId;

      // Schedule an appointment
      const appointmentParams = generateScheduleAppointmentParams({
        userId: oldUserId,
        memberId: member.id,
      });
      const appointment = await handler.mutations.scheduleAppointment({ appointmentParams });

      // replaceUserForMember
      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId: member.id,
        userId: newUser.id,
      };
      await handler.mutations.replaceUserForMember({ replaceUserForMemberParams });
      await delay(2000); // wait for event to finish

      // Check that the member's primary user changed
      const updatedMember = await handler
        .setContextUserId(member.id)
        .queries.getMember({ id: member.id });
      expect(updatedMember.primaryUserId).toEqual(newUser.id);
      expect(updatedMember.users[updatedMember.users.length - 1].id).toEqual(newUser.id);
      expect(updatedMember.users.length).toEqual(2);

      await delay(500);

      // Check that the appointment moved from the old user to the new
      const { appointments: newUserAppointments } = await handler
        .setContextUserId(newUser.id)
        .queries.getUser();
      const { appointments: oldUserAppointments } = await handler
        .setContextUserId(oldUserId)
        .queries.getUser();
      const newUserAppointmentsIds = newUserAppointments.map((app) => app.id);
      const oldUserAppointmentsIds = oldUserAppointments.map((app) => app.id);
      expect(newUserAppointmentsIds).toContain(appointment.id);
      expect(oldUserAppointmentsIds).not.toContain(appointment.id);
    });

    it("should throw an error when the new user doesn't exist", async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId: member.id,
        userId: generateId(),
      };
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.userNotFound)],
      });
    });

    it('should fail to update on non existing member', async () => {
      const user = await creators.createAndValidateUser();
      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId: generateId(),
        userId: user.id,
      };
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberNotFound)],
      });
    });

    it('should throw an error if the new user equals the old user', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
      };

      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberReplaceUserAlreadyExists)],
      });
    });
  });

  describe('notifications', () => {
    test.each`
      type                      | isVideo  | metadata
      ${NotificationType.video} | ${true}  | ${{ peerId: v4() }}
      ${NotificationType.call}  | ${false} | ${{ peerId: v4() }}
      ${NotificationType.text}  | ${false} | ${{ content: 'text' }}
    `(`should send push notification of type $type`, async (params) => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const primaryUser = member.users[0];

      const registerForNotificationParams: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams });

      const memberConfig = await handler
        .setContextUserId(member.id)
        .queries.getMemberConfig({ id: member.id });

      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: primaryUser.id,
        type: params.type,
        metadata: params.metadata,
      };

      await handler.mutations.notify({ notifyParams });

      expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
        sendOneSignalNotification: {
          externalUserId: memberConfig.externalUserId,
          platform: memberConfig.platform,
          data: {
            user: {
              id: primaryUser.id,
              firstName: primaryUser.firstName,
              avatar: primaryUser.avatar,
            },
            member: { phone: member.phone },
            type: params.type,
            peerId: notifyParams.metadata.peerId,
            isVideo: params.isVideo,
            ...generatePath(params.type),
            extraData: JSON.stringify({ iceServers }),
          },
          content: notifyParams.metadata.content,
          orgName: org.name,
        },
      });

      handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
    });

    it(`should send SMS notification of type textSms`, async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const appointmentId = generateId();
      const registerForNotificationParams: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams });
      await delay(500);

      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.textSms,
        metadata: { content: 'text', appointmentId },
      };

      /**
       * reset mock on NotificationsService so we dont count
       * the notifications that are made on member creation
       */
      handler.notificationsService.spyOnNotificationsServiceSend.mockReset();

      await handler.mutations.notify({ notifyParams });
      await delay(500);
      expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
        sendTwilioNotification: {
          to: member.phone,
          body: notifyParams.metadata.content,
          orgName: org.name,
        },
      });

      handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
    });

    it(`should send SendBird message for type textSms`, async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const appointmentId = generateId();

      const registerForNotificationParams: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams });

      const notifyParams: NotifyParams = {
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        type: NotificationType.textSms,
        metadata: { content: 'text', appointmentId },
      };

      /**
       * reset mock on NotificationsService so we dont count
       * the notifications that are made on member creation
       */
      handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
      await delay(500);

      await handler.mutations.notify({ notifyParams });

      const result = await handler.communicationService.get({
        userId: member.primaryUserId.toString(),
        memberId: member.id,
      });

      expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
        sendSendBirdNotification: {
          userId: member.primaryUserId,
          sendBirdChannelUrl: result.sendBirdChannelUrl,
          message: notifyParams.metadata.content,
          appointmentId,
          notificationType: NotificationType.textSms,
          orgName: org.name,
        },
      });

      handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
    });

    test.each([
      CancelNotificationType.cancelVideo,
      CancelNotificationType.cancelCall,
      CancelNotificationType.cancelText,
    ])(`should cancel a notification of type %p`, async (params) => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const registerForNotificationParams: RegisterForNotificationParams = {
        platform: Platform.android,
        isPushNotificationsEnabled: true,
      };
      await handler
        .setContextUserId(member.id)
        .mutations.registerMemberForNotifications({ registerForNotificationParams });

      const memberConfig = await handler
        .setContextUserId(member.id)
        .queries.getMemberConfig({ id: member.id });

      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        memberId: member.id,
        type: params,
      });

      await handler.mutations.cancel({ cancelNotifyParams });
      expect(handler.notificationsService.spyOnNotificationsServiceCancel).toBeCalledWith({
        externalUserId: memberConfig.externalUserId,
        platform: memberConfig.platform,
        data: {
          type: cancelNotifyParams.type,
          peerId: cancelNotifyParams.metadata.peerId,
          notificationId: cancelNotifyParams.notificationId,
        },
      });

      handler.notificationsService.spyOnNotificationsServiceCancel.mockReset();
    });
  });

  describe('user', () => {
    it('should set,get,delete availability of users', async () => {
      await createAndValidateAvailabilities(2);
      const { ids } = await createAndValidateAvailabilities(5);

      const result = await handler.mutations.deleteAvailability({ id: ids[0] });
      expect(result).toBeTruthy();
    });

    /* eslint-disable max-len */
    test.each`
      additionalGetSlotsParams             | expectedDefaultSlots | testTitle
      ${{}}                                | ${6}                 | ${'should get default slots count not available'}
      ${{ allowEmptySlotsResponse: true }} | ${0}                 | ${'should get empty slots when enabling empty response'}
      ${{ defaultSlotsCount: 20 }}         | ${20}                | ${'should get specific default slots count if defaultSlotsCount'}
    `('$testTitle', async ({ additionalGetSlotsParams, expectedDefaultSlots }) => {
      /* eslint-enable max-len */
      const user = await creators.createAndValidateUser();
      const org = await creators.createAndValidateOrg();
      const member: Member = await creators.createAndValidateMember({ org, useNewUser: true });

      const appointmentParams = generateScheduleAppointmentParams({
        memberId: member.id,
        userId: user.id,
        start: add(startOfToday(), { hours: 9 }),
        end: add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
      });
      const appointment = await handler.mutations.scheduleAppointment({ appointmentParams });

      const result = await handler.queries.getUserSlots({
        appointmentId: appointment.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        ...additionalGetSlotsParams,
      });

      expect(result.slots.length).toBe(expectedDefaultSlots);
    });

    it('should get user slots', async () => {
      const user = await creators.createAndValidateUser();
      const org = await creators.createAndValidateOrg();
      const member: Member = await creators.createAndValidateMember({ org, useNewUser: true });

      await handler.setContextUserId(user.id).mutations.createAvailabilities({
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
        userId: user.id,
        start: add(startOfToday(), { hours: 9 }),
        end: add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
      });
      const appointment = await handler.mutations.scheduleAppointment({ appointmentParams });

      const result = await handler.queries.getUserSlots({
        appointmentId: appointment.id,
        notBefore: add(startOfToday(), { hours: 10 }),
      });

      expect(result).toEqual(
        expect.objectContaining({
          user: {
            id: user.id,
            firstName: user.firstName,
            roles: user.roles,
            avatar: user.avatar,
            description: user.description,
          },
          member: {
            id: member.id,
            firstName: member.firstName,
          },
          appointment: {
            id: appointment.id,
            start: appointment.start,
            method: appointment.method,
            duration: defaultSlotsParams.duration,
          },
        }),
      );
    });
  });

  describe('dispatch links', () => {
    it('should be able to get upload dispatch links of a member', async () => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });

      const result = await handler.queries.getMemberUploadDischargeDocumentsLinks({ id });
      expect(result).toEqual({
        dischargeNotesLink: 'https://some-url/upload',
        dischargeInstructionsLink: 'https://some-url/upload',
      });
    });

    it('should be able to get download dispatch links of a member', async () => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });

      const result = await handler
        .setContextUserId(id)
        .queries.getMemberDownloadDischargeDocumentsLinks({ id });
      expect(result).toEqual({
        dischargeNotesLink: 'https://some-url/download',
        dischargeInstructionsLink: 'https://some-url/download',
      });
    });
  });

  describe('notes', () => {
    it('should create update and delete appointment notes', async () => {
      const org = await creators.createAndValidateOrg();
      const member: Member = await creators.createAndValidateMember({ org, useNewUser: true });
      const scheduledAppointment = generateScheduleAppointmentParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        method: AppointmentMethod.chat,
      });
      const { id: appointmentId } = await creators.handler.mutations.scheduleAppointment({
        appointmentParams: scheduledAppointment,
      });
      let appointment = await creators.handler.queries.getAppointment(appointmentId);

      expect(appointment.notes).toBeNull();

      let updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment(appointment.id);

      expect(appointment.notes).toMatchObject(updateNotesParams.notes);

      updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment(appointment.id);

      expect(appointment.notes).toMatchObject(updateNotesParams.notes);

      updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id, notes: null });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment(appointment.id);

      expect(appointment.notes).toBeNull();
    });

    it('should be able to set note for and nurseNotes for a member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

      const memberResult = await handler
        .setContextUserId(member.id)
        .queries.getMember({ id: member.id });
      expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);
      expect(memberResult.nurseNotes).toEqual(setGeneralNotesParams.nurseNotes);
    });

    it('should be able to set null note and nurseNotes for a member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

      let memberResult = await handler
        .setContextUserId(member.id)
        .queries.getMember({ id: member.id });
      expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);

      delete setGeneralNotesParams.note;
      delete setGeneralNotesParams.nurseNotes;
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

      memberResult = await handler.setContextUserId(member.id).queries.getMember({ id: member.id });
      expect(memberResult.generalNotes).toBeNull();
      expect(memberResult.nurseNotes).toBeNull();
    });
  });

  describe('drg', () => {
    it('should return the default path for a non existing drg on getMemberConfig', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const memberConfig = await handler
        .setContextUserId(member.id)
        .queries.getMemberConfig({ id: member.id });
      expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.default'));
    });

    it('should return the configured path for a configured drg on getMemberConfig', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });

      const updateMemberParams = generateUpdateMemberParams({ id: member.id, drg: '123' });
      await handler.mutations.updateMember({ updateMemberParams });

      const memberConfig = await handler
        .setContextUserId(member.id)
        .queries.getMemberConfig({ id: member.id });
      expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.123'));
    });
  });

  describe('recordings', () => {
    it('should be able to get upload recordings of a member', async () => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });

      const result = await handler.queries.getMemberUploadRecordingLink({
        recordingLinkParams: {
          memberId: id,
          id: `${faker.lorem.word()}.mp4`,
        },
      });
      expect(result).toEqual('https://some-url/upload');
    });

    it('should be able to get download recordings of a member', async () => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });

      const result = await handler.queries.getMemberDownloadRecordingLink({
        recordingLinkParams: {
          memberId: id,
          id: `${faker.lorem.word()}.mp4`,
        },
      });
      expect(result).toEqual('https://some-url/download');
    });

    it('should update recordings for multiple members and get those recordings', async () => {
      const compareRecording = (rec1: RecordingOutput, rec2: UpdateRecordingParams) => {
        expect(rec1.id).toEqual(rec2.id);
        expect(rec1.userId).toEqual(rec2.userId);
        expect(new Date(rec1.start)).toEqual(rec2.start);
        expect(new Date(rec1.end)).toEqual(rec2.end);
        expect(rec1.answered).toEqual(rec2.answered);
        expect(rec1.phone).toEqual(rec2.phone);
      };

      const org = await creators.createAndValidateOrg();
      const { id: memberId1 } = await creators.createAndValidateMember({ org });
      const { id: memberId2 } = await creators.createAndValidateMember({ org });

      const rec1a = generateUpdateRecordingParams({ memberId: memberId1 });
      const rec1b = generateUpdateRecordingParams({ memberId: memberId1 });
      const rec2 = generateUpdateRecordingParams({ memberId: memberId2 });
      await handler.mutations.updateRecording({ updateRecordingParams: rec1a });
      await handler.mutations.updateRecording({ updateRecordingParams: rec1b });
      await handler.mutations.updateRecording({ updateRecordingParams: rec2 });

      const result1 = await handler.queries.getRecordings({ memberId: memberId1 });
      expect(result1.length).toEqual(2);
      compareRecording(result1[0], rec1a);
      compareRecording(result1[1], rec1b);
      const result2 = await handler.queries.getRecordings({ memberId: memberId2 });
      expect(result2.length).toEqual(1);
      compareRecording(result2[0], rec2);
    });

    it('should delete recordings and media files on unconsented appointment end', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org, useNewUser: true });
      const appointmentParams = generateScheduleAppointmentParams({
        memberId: member.id,
        userId: member.users[0].id,
        start: new Date(),
      });

      const appointment = await creators.handler.mutations.scheduleAppointment({
        appointmentParams,
      });
      const memberId = appointment.memberId.toString();
      const appointmentId = appointment.id.toString();

      const recording1 = generateUpdateRecordingParams({
        memberId,
        appointmentId,
        end: new Date(),
      });
      const recording2 = generateUpdateRecordingParams({
        memberId,
        appointmentId,
        end: new Date(),
      });
      const result1 = await handler.queries.getRecordings({ memberId: memberId });
      expect(result1.length).toBe(0);
      await handler.mutations.updateRecording({ updateRecordingParams: recording1 });
      await handler.mutations.updateRecording({ updateRecordingParams: recording2 });

      const result2 = await handler.queries.getRecordings({
        memberId: memberId,
      });
      expect(result2.length).toBe(2);
      await handler.mutations.endAppointment({
        endAppointmentParams: {
          id: appointmentId,
          noShow: false,
          recordingConsent: false,
        },
      });
      await delay(500); // wait for event to finish
      const result3 = await handler.queries.getRecordings({
        memberId: memberId,
      });
      expect(result3.length).toBe(2);
      expect(result3.every(({ deletedMedia }) => deletedMedia === true)).toBe(true);
    });
  });

  describe('Daily Reports', () => {
    it('set/get a dailyReport', async () => {
      const { updatedDailyReport } = await handler
        .setContextUserId(handler.patientZero.id.toString())
        .mutations.setDailyReportCategories({
          dailyReportCategoriesInput: {
            date: '2015/01/01',
            categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          } as DailyReportCategoriesInput,
        });
      expect(updatedDailyReport).toEqual({
        categories: [{ rank: 1, category: 'Pain' }],
        memberId: handler.patientZero.id.toString(),
        date: '2015/01/01',
        statsOverThreshold: null,
      });

      const { dailyReports } = await handler
        .setContextUserId(handler.patientZero.id.toString())
        .queries.getDailyReports({
          dailyReportQueryInput: {
            startDate: '2015/01/01',
            endDate: '2015/01/01',
            memberId: handler.patientZero.id.toString(),
          } as DailyReportQueryInput,
        });

      expect(dailyReports).toEqual({
        data: [
          {
            categories: [{ category: 'Pain', rank: 1 }],
            date: '2015/01/01',
            statsOverThreshold: null,
            memberId: handler.patientZero.id.toString(),
          },
        ],
        metadata: { minDate: '2015/01/01' },
      });
    });
  });

  describe('Journal', () => {
    it('should create get update and delete member journal', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const { id: journalId } = await handler.setContextUserId(member.id).mutations.createJournal();
      const journalBeforeUpdate = await handler
        .setContextUserId(member.id)
        .queries.getJournal({ id: journalId });

      expect(journalBeforeUpdate).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: null,
      });

      const updateJournalTextParams: UpdateJournalTextParams = generateUpdateJournalTextParams({
        id: journalId,
      });
      const journalAfterUpdate = await handler
        .setContextUserId(member.id)
        .mutations.updateJournalText({
          updateJournalTextParams,
        });

      expect(journalAfterUpdate).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: updateJournalTextParams.text,
      });

      const journals = await handler.setContextUserId(member.id).queries.getJournals();

      expect(journals[0]).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: updateJournalTextParams.text,
      });

      await handler.setContextUserId(member.id).mutations.deleteJournal({ id: journalId });
      await handler.setContextUserId(member.id).queries.getJournal({
        id: journalId,
        invalidFieldsError: Errors.get(ErrorType.memberJournalNotFound),
      });
    });
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

    const availabilities = Array.from(Array(count)).map(() => generateAvailabilityInput());

    const { ids } = await handler.setContextUserId(userId).mutations.createAvailabilities({
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
