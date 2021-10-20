import * as config from 'config';
import * as faker from 'faker';
import { v4 } from 'uuid';
import {
  AppointmentMethod,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
} from '../../src/appointment';
import {
  AppointmentStatus,
  CancelNotificationType,
  ErrorType,
  Errors,
  Identifiers,
  InternalNotificationType,
  NotificationType,
  Platform,
  RegisterForNotificationParams,
} from '../../src/common';
import {
  CancelNotifyParams,
  CreateTaskParams,
  Member,
  MemberConfig,
  NotifyParams,
  RecordingOutput,
  Task,
  TaskStatus,
  UpdateRecordingParams,
} from '../../src/member';
import { UserRole } from '../../src/user';
import { AppointmentsIntegrationActions } from '../aux/appointments';
import { Creators } from '../aux/creators';
import { Handler } from '../aux/handler';
import {
  delay,
  generateAppointmentLink,
  generateAvailabilityInput,
  generateCancelNotifyParams,
  generateCreateMemberParams,
  generateId,
  generateOrgParams,
  generatePath,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
  generateUpdateNotesParams,
  generateUpdateRecordingParams,
} from '../index';

describe('Integration tests: all', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;
  let mockCommunicationParams;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    mockCommunicationParams = handler.mockCommunication();
    await creators.createFirstUserInDbfNecessary();
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
    const resultNurse1 = await creators.createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await creators.createAndValidateUser([UserRole.nurse]);

    const resultOrg = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org: resultOrg });
    const primaryCoach = member.users[0];

    const scheduledAppointmentPrimaryUser = await creators.createAndValidateAppointment({
      member,
    });

    const scheduledAppointmentNurse1 = await creators.createAndValidateAppointment({
      member,
      userId: resultNurse1.id,
    });

    const scheduledAppointmentNurse2 = await creators.createAndValidateAppointment({
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

    const resultMember = await handler.queries.getMember({ id: member.id });

    expect(
      resultMember.users.filter((user) => user.id === primaryCoach.id)[0].appointments[0],
    ).toEqual(expect.objectContaining({ status: AppointmentStatus.done }));
    expect(scheduledAppointmentPrimaryUser).toEqual(
      expect.objectContaining(
        resultMember.users.filter((user) => user.id === primaryCoach.id)[0].appointments[0],
      ),
    );

    expect(resultMember.users[0].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.done }),
    );
    expect(scheduledAppointmentNurse1).toEqual(
      expect.objectContaining(resultMember.users[1].appointments[0]),
    );

    expect(resultMember.users[1].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.done }),
    );
    expect(scheduledAppointmentNurse2).toEqual(
      expect.objectContaining(resultMember.users[2].appointments[0]),
    );
    expect(resultMember.scores).toEqual(scheduledAppointmentNurse2.notes.scores);

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
  it('getAppointments should return just the member appointment of a user', async () => {
    const org = await creators.createAndValidateOrg();
    const member1 = await creators.createAndValidateMember({ org });
    const member2 = await creators.createAndValidateMember({ org });

    const appointmentMember1 = await creators.createAndValidateAppointment({ member: member1 });
    const appointmentMember2 = await creators.createAndValidateAppointment({ member: member2 });

    const memberResult1 = await handler.queries.getMember({ id: member1.id });
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.users[0].appointments[0]),
    );

    const memberResult2 = await handler.queries.getMember({ id: member2.id });
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.users[0].appointments[0]),
    );
  });

  it('should update a member fields', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const updateMemberParams = generateUpdateMemberParams({ id: member.id });
    const updatedMemberResult = await handler.mutations.updateMember({ updateMemberParams });

    const memberResult = await handler.queries.getMember({ id: member.id });

    expect(memberResult).toEqual(expect.objectContaining(updatedMemberResult));
  });

  // https://app.clubhouse.io/laguna-health/story/1625/add-edit-for-member-s-users-and-primaryuserid
  it.skip('should return org zip code if member does not have one', async () => {
    const org = await creators.createAndValidateOrg();

    const memberParams = generateCreateMemberParams({ orgId: org.id });
    delete memberParams.zipCode;

    const member = await creators.handler.mutations.createMember({ memberParams });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.zipCode).toEqual(org.zipCode);
  });

  it('should calculate utcDelta if zipCode exists', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.utcDelta).toBeLessThan(0);
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

  it('should successfully create an org and then get it by id', async () => {
    const orgParams = generateOrgParams();
    const { id } = await handler.mutations.createOrg({ orgParams });
    const createdOrg = await handler.queries.getOrg({ id });

    expect(createdOrg).toEqual(expect.objectContaining({ ...orgParams, id }));
  });

  it('should return members appointment filtered by orgId', async () => {
    const org = await creators.createAndValidateOrg();
    const member1 = await creators.createAndValidateMember({ org });
    const primaryUser1 = member1.users[0];
    const member2 = await creators.createAndValidateMember({ org });
    const primaryUser2 = member1.users[0];

    const params1a = generateScheduleAppointmentParams({
      memberId: member1.id,
      userId: primaryUser1.id,
    });
    const params1b = generateScheduleAppointmentParams({
      memberId: member1.id,
      userId: primaryUser1.id,
    });
    const params2a = generateScheduleAppointmentParams({
      memberId: member2.id,
      userId: primaryUser2.id,
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
    const resultMember1 = await creators.handler.queries.getMember({ id: member1.id });
    const resultMember2 = await creators.handler.queries.getMember({ id: member2.id });

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

  it('should override requested appointment when calling schedule appointment', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const requestedAppointment = generateRequestAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId,
    });
    const { id: requestedId } = await creators.handler.mutations.requestAppointment({
      appointmentParams: requestedAppointment,
    });

    const scheduledAppointment = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId,
    });
    const { id: scheduledId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment,
    });

    expect(requestedId).toEqual(scheduledId);
    const result = await creators.handler.queries.getAppointment(scheduledId);
    expect(new Date(result.end)).toEqual(scheduledAppointment.end);
    expect(new Date(result.start)).toEqual(scheduledAppointment.start);
  });

  it('should create multiple new scheduled appointments', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const scheduledAppointment1 = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId,
      method: AppointmentMethod.chat,
    });
    const { id: requestedId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment1,
    });

    const scheduledAppointment2 = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId,
      method: AppointmentMethod.videoCall,
    });
    const { id: scheduledId } = await creators.handler.mutations.scheduleAppointment({
      appointmentParams: scheduledAppointment2,
    });

    expect(requestedId).not.toEqual(scheduledId);
  });

  it('should create update and delete appointment notes', async () => {
    const org = await creators.createAndValidateOrg();
    const member: Member = await creators.createAndValidateMember({ org });
    const scheduledAppointment = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.primaryUserId,
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

  it('should validate that getMember attach chat app link to each appointment', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const appointmentMember = await creators.createAndValidateAppointment({ member });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(appointmentMember).toEqual(
      expect.objectContaining({
        link: generateAppointmentLink(memberResult.users[0].appointments[0].id),
      }),
    );
  });

  it('web: should be able to getMember with member id', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult).toEqual(expect.objectContaining({ ...member }));
  });

  it('should be able to set note for a member', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    const memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);
  });

  it('should be able to set null note for a member', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    let memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);

    delete setGeneralNotesParams.note;
    await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

    memberResult = await handler.queries.getMember({ id: member.id });
    expect(memberResult.generalNotes).toBeNull();
  });

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

    const result = await handler.queries.getMemberDownloadDischargeDocumentsLinks({ id });
    expect(result).toEqual({
      dischargeNotesLink: 'https://some-url/download',
      dischargeInstructionsLink: 'https://some-url/download',
    });
  });

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

  // https://app.clubhouse.io/laguna-health/story/1625/add-edit-for-member-s-users-and-primaryuserid
  test.skip.each`
    register
    ${{ platform: Platform.ios, token: faker.lorem.word() }}
    ${{ platform: Platform.android }}
  `(
    /* eslint-enable max-len */
    `should registerMemberForNotifications and update MemberConfig on $register.platform`,
    async (params) => {
      const org = await creators.createAndValidateOrg();
      const { id } = await creators.createAndValidateMember({ org });

      const memberConfigDefault: MemberConfig = await handler.queries.getMemberConfig({ id });
      expect(memberConfigDefault).toEqual({
        memberId: id,
        externalUserId: expect.any(String),
        platform: Platform.web,
      });

      const registerForNotificationParams: RegisterForNotificationParams = {
        memberId: id,
        ...params.register,
      };
      await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

      if (params.register.platform === Platform.ios) {
        expect(handler.notificationsService.spyOnNotificationsServiceRegister).toBeCalledWith({
          sendNotificationToMemberParams: {
            token: registerForNotificationParams.token,
            externalUserId: memberConfigDefault.externalUserId,
          },
        });
      } else {
        expect(handler.notificationsService.spyOnNotificationsServiceRegister).not.toBeCalled();
      }

      const newMemberConfig: MemberConfig = await handler.queries.getMemberConfig({ id });
      expect(newMemberConfig).toEqual({
        memberId: id,
        externalUserId: expect.any(String),
        platform: params.register.platform,
      });

      handler.notificationsService.spyOnNotificationsServiceRegister.mockReset();
    },
  );

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
      memberId: member.id,
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

    const memberConfig = await handler.queries.getMemberConfig({ id: member.id });

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
          member: {
            phone: member.phone,
          },
          type: params.type,
          peerId: notifyParams.metadata.peerId,
          isVideo: params.isVideo,
          ...generatePath(params.type),
        },
        metadata: notifyParams.metadata,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });

  it('should return the default path for a non existing drg on getMemberConfig', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const memberConfig = await handler.queries.getMemberConfig({ id: member.id });
    expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.default'));
  });

  it('should return the configured path for a configured drg on getMemberConfig', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const updateMemberParams = generateUpdateMemberParams({ id: member.id, drg: 123 });
    await handler.mutations.updateMember({ updateMemberParams });

    const memberConfig = await handler.queries.getMemberConfig({ id: member.id });
    expect(memberConfig.articlesPath).toEqual(config.get('articlesByDrg.123'));
  });

  it(`should send SMS notification of type textSms`, async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });
    const registerForNotificationParams: RegisterForNotificationParams = {
      memberId: member.id,
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

    const notifyParams: NotifyParams = {
      memberId: member.id,
      userId: member.primaryUserId,
      type: NotificationType.textSms,
      metadata: { content: 'text' },
    };

    await handler.mutations.notify({ notifyParams });

    expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
      sendTwilioNotification: {
        to: member.phone,
        body: notifyParams.metadata.content,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });

  it(`should send Sendbird message for type textSms`, async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const registerForNotificationParams: RegisterForNotificationParams = {
      memberId: member.id,
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

    const notifyParams: NotifyParams = {
      memberId: member.id,
      userId: member.primaryUserId,
      type: NotificationType.textSms,
      metadata: { content: 'text' },
    };

    await handler.mutations.notify({ notifyParams });

    expect(handler.notificationsService.spyOnNotificationsServiceSend).toBeCalledWith({
      sendSendBirdNotification: {
        userId: member.primaryUserId,
        sendBirdChannelUrl: mockCommunicationParams.sendBirdChannelUrl,
        message: notifyParams.metadata.content,
        notificationType: NotificationType.textSms,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
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
      memberId: member.id,
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });
    const memberConfig = await handler.queries.getMemberConfig({ id: member.id });

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
        metadata: notifyParams.metadata,
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });

  test.each([
    CancelNotificationType.cancelVideo,
    CancelNotificationType.cancelCall,
    CancelNotificationType.cancelText,
  ])(`should cancel a notification of type $type`, async (params) => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });
    const registerForNotificationParams: RegisterForNotificationParams = {
      memberId: member.id,
      platform: Platform.android,
      isPushNotificationsEnabled: true,
    };
    await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });

    const memberConfig = await handler.queries.getMemberConfig({ id: member.id });

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

  /* eslint-disable max-len */
  test.each`
    title | method
    ${'requestAppointment'} | ${async ({ memberId, userId }) => await handler.mutations.requestAppointment({
    appointmentParams: generateRequestAppointmentParams({
      memberId,
      userId,
    }),
  })}
    ${'scheduleAppointment'} | ${async ({ memberId, userId }) => await handler.mutations.scheduleAppointment({
    appointmentParams: generateScheduleAppointmentParams({
      memberId,
      userId,
    }),
  })}
  `(`should add a not existed user to member users list on $title`, async (params) => {
    /* eslint-enable max-len */
    const user = await creators.createAndValidateUser();
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    const initialMember = await handler.queries.getMember({ id: member.id });
    expect(initialMember.users.length).toEqual(1);
    expect(initialMember.users[0].id).toEqual(member.primaryUserId);

    //calling twice, to check that the user wasn't added twice to users list
    await params.method({ userId: user.id, memberId: member.id });
    await params.method({ userId: user.id, memberId: member.id });

    const { users } = await handler.queries.getMember({ id: member.id });

    const ids = users.map((user) => user.id);
    expect(ids.length).toEqual(2);
    expect(ids[0]).toEqual(member.primaryUserId);
    expect(ids[1]).toEqual(user.id);
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

  it('should register scheduled appointment reminder and notify it to member', async () => {
    const org = await creators.createAndValidateOrg();
    const member = await creators.createAndValidateMember({ org });

    await delay(1000);

    const milliseconds = (config.get('scheduler.alertBeforeInMin') + 1 / 60) * 60 * 1000;
    const start = new Date();
    start.setMilliseconds(start.getMilliseconds() + milliseconds);
    Date.now = jest.fn(() => milliseconds - 1000);

    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: member.users[0].id,
      start,
    });

    /**
     * reset mock on NotificationsService so we dont count
     * the notifications that are made on member creation
     */
    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();

    await creators.handler.mutations.scheduleAppointment({ appointmentParams });

    await delay(2000);

    expect(handler.notificationsService.spyOnNotificationsServiceSend).toHaveBeenNthCalledWith(1, {
      sendTwilioNotification: {
        to: member.users[0].phone,
        body: expect.any(String),
      },
    });

    expect(handler.notificationsService.spyOnNotificationsServiceSend).toHaveBeenNthCalledWith(2, {
      sendTwilioNotification: {
        to: member.phone,
        body: expect.any(String),
      },
    });

    handler.notificationsService.spyOnNotificationsServiceSend.mockReset();
  });
  describe('new member + member registration scheduling', () => {
    it('should create timeout on member creation', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      expect(handler.schedulerRegistry.getTimeouts()).toEqual(expect.arrayContaining([member.id]));
    });

    it('should create timeout for registered member', async () => {
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
      const registerForNotificationParams: RegisterForNotificationParams = {
        isPushNotificationsEnabled: true,
        platform: Platform.ios,
        memberId: member.id,
        token: 'sampleiospushkittokentest',
      };
      await handler.mutations.registerMemberForNotifications({ registerForNotificationParams });
      expect(handler.schedulerRegistry.getTimeouts()).toEqual(expect.arrayContaining([member.id]));
    });

    it('should delete timeout for member if an appointment is scheduled', async () => {
      const primaryUser = await creators.createAndValidateUser();
      const org = await creators.createAndValidateOrg();
      const member = await creators.createAndValidateMember({ org });
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
