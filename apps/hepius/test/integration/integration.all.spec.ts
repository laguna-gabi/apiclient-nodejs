import { AppointmentInternalKey, LogInternalKey } from '@argus/irisClient';
import { GlobalEventType, Language, Platform } from '@argus/pandora';
import { articlesByDrg, general, hosts } from 'config';
import { add, addDays, startOfToday, startOfTomorrow, sub } from 'date-fns';
import { date, lorem } from 'faker';
import { v4 } from 'uuid';
import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateAdmissionActivityParams,
  generateAdmissionDiagnosisParams,
  generateAdmissionDietaryParams,
  generateAdmissionExternalAppointmentParams,
  generateAdmissionMedicationParams,
  generateAdmissionProcedureParams,
  generateAdmissionWoundCareParams,
  generateAppointmentLink,
  generateAvailabilityInput,
  generateCarePlanTypeInput,
  generateCreateBarrierParamsWizard,
  generateCreateCarePlanParams,
  generateCreateCarePlanParamsWizard,
  generateCreateMemberParams,
  generateCreateQuestionnaireParams,
  generateCreateRedFlagParamsWizard,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateDeleteMemberParams,
  generateGetTodoDonesParams,
  generateId,
  generateOrgParams,
  generateRequestAppointmentParams,
  generateRequestHeaders,
  generateScheduleAppointmentParams,
  generateSetGeneralNotesParams,
  generateSubmitCareWizardParams,
  generateSubmitQuestionnaireResponseParams,
  generateUpdateBarrierParams,
  generateUpdateCarePlanParams,
  generateUpdateCaregiverParams,
  generateUpdateJournalTextParams,
  generateUpdateMemberConfigParams,
  generateUpdateMemberParams,
  generateUpdateNotesParams,
  generateUpdateRecordingParams,
  generateUpdateRedFlagParams,
  generateUpdateTodoParams,
  generateUpdateUserParams,
  mockGenerateDispatch,
  mockGenerateQuestionnaireItem,
  mockGenerateUser,
  removeChangeType,
  submitMockCareWizard,
} from '..';
import { buildLHPQuestionnaire } from '../../cmd/static';
import {
  Appointment,
  AppointmentMethod,
  AppointmentStatus,
  RequestAppointmentParams,
  ScheduleAppointmentParams,
} from '../../src/appointment';
import { CareStatus, CreateCarePlanParams } from '../../src/care';
import {
  ChangeType,
  ErrorType,
  Errors,
  EventType,
  IEventOnUpdatedUser,
  Identifiers,
  ItemType,
  UserRole,
  delay,
  reformatDate,
} from '../../src/common';
import { DailyReportCategoryTypes, DailyReportQueryInput } from '../../src/dailyReport';
import {
  AlertType,
  ChangeAdmissionParams,
  CreateTaskParams,
  Member,
  MemberAdmission,
  Recording,
  RecordingOutput,
  ReplaceUserForMemberParams,
  Task,
  TaskStatus,
  UpdateJournalTextParams,
  defaultMemberParams,
} from '../../src/member';
import { Internationalization } from '../../src/providers';
import {
  CreateQuestionnaireParams,
  HealthPersona,
  QuestionnaireType,
} from '../../src/questionnaire';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  TodoLabel,
  TodoStatus,
  UpdateTodoParams,
} from '../../src/todo';
import { User, defaultSlotsParams } from '../../src/user';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';

describe('Integration tests: all', () => {
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
     * 11. Create action items for a member
     * 12. Update action items for a member
     * 13. Fetch member and checks all related appointments
     */
    const resultNurse1 = await creators.createAndValidateUser({
      roles: [UserRole.nurse, UserRole.coach],
    });
    const resultNurse2 = await creators.createAndValidateUser({ roles: [UserRole.nurse] });

    const { member } = await creators.createMemberUserAndOptionalOrg();

    const appointmentPrimaryUser = await creators.createAndValidateAppointment({ member });

    const appointmentNurse1 = await creators.createAndValidateAppointment({
      member,
      userId: resultNurse1.id,
    });

    const appointmentNurse2 = await creators.createAndValidateAppointment({
      member,
      userId: resultNurse2.id,
    });

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

    const resultMember = await handler.queries.getMember({
      id: member.id,
      requestHeaders: generateRequestHeaders(member.authId),
    });

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

    //action items are desc sorted, so the last inserted action item is the 1st in the list
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
    const { member: member1 } = await creators.createMemberUserAndOptionalOrg();
    const { member: member2 } = await creators.createMemberUserAndOptionalOrg();

    const appointmentMember1 = await creators.createAndValidateAppointment({ member: member1 });
    const appointmentMember2 = await creators.createAndValidateAppointment({ member: member2 });

    const memberResult1 = await handler.queries.getMember({
      id: member1.id,
      requestHeaders: generateRequestHeaders(member1.authId),
    });
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.users[0].appointments[0]),
    );

    const memberResult2 = await handler.queries.getMember({
      id: member2.id,
      requestHeaders: generateRequestHeaders(member2.authId),
    });
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.users[0].appointments[0]),
    );
  });

  it('should successfully create an org and then get it by id', async () => {
    const orgParams = generateOrgParams();
    const { id } = await handler.mutations.createOrg({ orgParams });
    const createdOrg = await handler.queries.getOrg({ id });
    const orgs = await handler.queries.getOrgs({
      requestHeaders: handler.defaultAdminRequestHeaders,
    });

    expect(createdOrg).toEqual(expect.objectContaining({ ...orgParams, id }));
    expect(orgs).toEqual(expect.arrayContaining([expect.objectContaining({ ...orgParams, id })]));
  });

  it('should change member org', async () => {
    const orgParams1 = generateOrgParams();
    const { id: orgId1 } = await handler.mutations.createOrg({ orgParams: orgParams1 });
    const orgParams2 = generateOrgParams();
    const { id: orgId2 } = await handler.mutations.createOrg({ orgParams: orgParams2 });

    const { member } = await creators.createMemberUserAndOptionalOrg({ orgId: orgId1 });
    expect(member.org.id).toEqual(orgId1);

    await handler.mutations.replaceMemberOrg({
      replaceMemberOrgParams: { memberId: member.id, orgId: orgId2 },
    });

    const updatedMember = await handler.queries.getMember({ id: member.id });
    expect(updatedMember.org.id).toEqual(orgId2);
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

    const result = await creators.handler.queries.getMembersAppointments(org.id);
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

  it('should validate that getMember attach chat app link to each appointment', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    const appointmentMember = await creators.createAndValidateAppointment({ member });

    const memberResult = await handler.queries.getMember({
      id: member.id,
      requestHeaders: generateRequestHeaders(member.authId),
    });
    expect(appointmentMember).toEqual(
      expect.objectContaining({
        link: generateAppointmentLink(memberResult.users[0].appointments[0].id),
      }),
    );
  });

  it('should update and get member', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    const updateMemberParams = generateUpdateMemberParams({ id: member.id });
    await handler.mutations.updateMember({ updateMemberParams });

    const memberAfter = await handler.queries.getMember({ id: member.id });
    expect(memberAfter).toEqual(
      expect.objectContaining({
        ...updateMemberParams,
        isGraduated: defaultMemberParams.isGraduated,
      }),
    );
  });

  it('should update and get member configs', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();
    const requestHeaders = generateRequestHeaders(member.authId);

    const memberConfigBefore = await handler.queries.getMemberConfig({
      id: member.id,
      requestHeaders,
    });
    expect(memberConfigBefore).toEqual({
      memberId: member.id,
      articlesPath: articlesByDrg.default,
      externalUserId: expect.any(String),
      firstLoggedInAt: null,
      lastLoggedInAt: null,
      platform: Platform.web,
      isPushNotificationsEnabled: true,
      isAppointmentsReminderEnabled: true,
      isRecommendationsEnabled: true,
      isTodoNotificationsEnabled: true,
      language: Language.en,
    });

    const updateMemberConfigParams = generateUpdateMemberConfigParams();
    delete updateMemberConfigParams.memberId;
    await handler.mutations.updateMemberConfig({ updateMemberConfigParams, requestHeaders });
    const memberConfigAfter = await handler.queries.getMemberConfig({
      id: member.id,
      requestHeaders,
    });

    expect(memberConfigAfter).toEqual({
      memberId: member.id,
      externalUserId: memberConfigBefore.externalUserId,
      firstLoggedInAt: null,
      lastLoggedInAt: null,
      articlesPath: memberConfigBefore.articlesPath,
      platform: Platform.web,
      isPushNotificationsEnabled: updateMemberConfigParams.isPushNotificationsEnabled,
      isAppointmentsReminderEnabled: updateMemberConfigParams.isAppointmentsReminderEnabled,
      isRecommendationsEnabled: updateMemberConfigParams.isRecommendationsEnabled,
      isTodoNotificationsEnabled: updateMemberConfigParams.isTodoNotificationsEnabled,
      language: Language.en,
    });
  });

  it('should assign user from the same org to member', async () => {
    const org = await creators.createAndValidateOrg();
    const { id: userId } = await creators.createAndValidateUser({ orgId: org.id });
    const memberParams = generateCreateMemberParams({ orgId: org.id });
    handler.featureFlagService.spyOnFeatureFlagControlGroup.mockImplementationOnce(
      async () => false,
    );

    const { id } = await handler.mutations.createMember({
      memberParams,
    });

    const { primaryUserId } = await handler.queries.getMember({ id });
    expect(primaryUserId).toEqual(userId);
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
    const { member } = await creators.createMemberUserAndOptionalOrg();
    const requestHeaders = generateRequestHeaders(member.authId);

    const initialMember = await handler.queries.getMember({ id: member.id, requestHeaders });
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

    const { users } = await handler.queries.getMember({ id: member.id, requestHeaders });

    const ids = users.map((user) => user.id);
    expect(ids.length).toEqual(2);
    expect(ids[0]).toEqual(member.primaryUserId);
    expect(ids[1]).toEqual(newUser.id);
  });

  describe('new member + member registration scheduling', () => {
    it('should delete timeout for member if an appointment is scheduled', async () => {
      const primaryUser = await creators.createAndValidateUser();
      const { member } = await creators.createMemberUserAndOptionalOrg();
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
    });
  });

  describe('delete member', () => {
    test.each([true, false])('should delete a member ', async (hard) => {
      // setup
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const appointment = await creators.createAndValidateAppointment({ member });
      const recording = generateUpdateRecordingParams({
        memberId: member.id,
        appointmentId: appointment.id,
        end: new Date(),
      });
      await handler.mutations.updateRecording({ updateRecordingParams: recording });

      const startDate = date.past();
      const day1 = reformatDate(startDate.toString(), general.get('dateFormatString'));
      const day2 = reformatDate(
        add(startDate, { days: 2 }).toString(),
        general.get('dateFormatString'),
      );
      await handler.mutations.setDailyReportCategories({
        requestHeaders: generateRequestHeaders(member.authId),
        dailyReportCategoriesInput: {
          date: day1,
          categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
        },
      });

      const requestHeaders = generateRequestHeaders(member.authId);
      await createTodos(member.id, requestHeaders);

      const { id: journalId } = await handler.mutations.createJournal({ requestHeaders });
      await handler.mutations.updateJournalText({
        requestHeaders,
        updateJournalTextParams: generateUpdateJournalTextParams({ id: journalId }),
      });

      const addCaregiverParams = generateAddCaregiverParams({ memberId: member.id });
      await handler.mutations.addCaregiver({ addCaregiverParams, requestHeaders });

      await submitMockCareWizard(handler, member.id);

      // submit QR for member
      await submitQR(member.id);

      // delete member
      const deleteMemberParams = generateDeleteMemberParams({ id: member.id, hard });
      const result = await handler.mutations.deleteMember({ deleteMemberParams });
      expect(result).toBeTruthy();
      await delay(500);

      // test that everything was deleted
      await handler.queries.getMember({
        id: member.id,
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
        requestHeaders: handler.defaultAdminRequestHeaders,
      });

      const communication = await handler.queries.getCommunication({
        getCommunicationParams: { memberId: member.id, userId: member.primaryUserId.toString() },
      });
      expect(communication).toBeNull();

      const recordings = await handler.queries.getRecordings({ memberId: member.id });
      expect(recordings.length).toEqual(0);

      const dailyReports = await handler.queries.getDailyReports({
        dailyReportQueryInput: {
          memberId: member.id,
          startDate: day1,
          endDate: day2,
        },
      });
      expect(dailyReports.data.length).toEqual(0);

      const appointmentResult = await handler.queries.getAppointment({ id: appointment.id });
      expect(appointmentResult).toBeNull();

      const todos = await handler.queries.getTodos({ memberId: member.id });
      expect(todos.length).toEqual(0);

      const caregivers = await handler.queries.getCaregivers({ memberId: member.id });
      expect(caregivers.length).toEqual(0);

      const journals = await handler.queries.getJournals({
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });
      expect(journals.length).toEqual(0);

      const qrs = await handler.queries.getMemberQuestionnaireResponses({
        memberId: member.id,
      });
      expect(qrs.length).toEqual(0);

      // get all member's red flags, barriers and care plans
      const memberRedFlags = await handler.queries.getMemberRedFlags({
        memberId: member.id,
      });
      expect(memberRedFlags.length).toEqual(0);

      const memberBarriers = await handler.queries.getMemberBarriers({
        memberId: member.id,
      });
      expect(memberBarriers.length).toEqual(0);

      const memberCarePlans = await handler.queries.getMemberCarePlans({
        memberId: member.id,
      });
      expect(memberCarePlans.length).toEqual(0);
    });
  });

  describe('replaceUserForMember', () => {
    it('should set new user for a given member', async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const oldUserId = member.primaryUserId.toString();
      const newUser = await creators.createAndValidateUser();
      const requestHeadersOldUser = generateRequestHeaders(user.authId);
      const requestHeadersNewUser = generateRequestHeaders(newUser.authId);

      // Schedule an appointment
      const appointmentParams = generateScheduleAppointmentParams({
        userId: oldUserId,
        memberId: member.id,
      });
      const appointment = await handler.mutations.scheduleAppointment({
        appointmentParams,
        requestHeaders: requestHeadersOldUser,
      });

      // replaceUserForMember
      const replaceUserForMemberParams: ReplaceUserForMemberParams = {
        memberId: member.id,
        userId: newUser.id,
      };
      await handler.mutations.replaceUserForMember({ replaceUserForMemberParams });
      await delay(2000); // wait for event to finish

      // Check that the member's primary user changed
      const updatedMember = await handler.queries.getMember({ id: member.id });
      expect(updatedMember.primaryUserId).toEqual(newUser.id);
      expect(updatedMember.users[updatedMember.users.length - 1].id).toEqual(newUser.id);
      expect(updatedMember.users.length).toEqual(2);

      await delay(500);

      // Check that the appointment moved from the old user to the new
      const { appointments: newUserAppointments } = await handler.queries.getUser({
        requestHeaders: requestHeadersNewUser,
      });
      const { appointments: oldUserAppointments } = await handler.queries.getUser({
        requestHeaders: requestHeadersOldUser,
      });
      const newUserAppointmentsIds = newUserAppointments.map((app) => app.id);
      const oldUserAppointmentsIds = oldUserAppointments.map((app) => app.id);
      expect(newUserAppointmentsIds).toContain(appointment.id);
      expect(oldUserAppointmentsIds).not.toContain(appointment.id);
    });

    it(`should throw an error when the new user doesn't exist`, async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

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
      const { member } = await creators.createMemberUserAndOptionalOrg();
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
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      const appointmentParams = generateScheduleAppointmentParams({
        memberId: member.id,
        userId: user.id,
        start: add(startOfToday(), { hours: 9 }),
        end: add(startOfToday(), { hours: 9, minutes: defaultSlotsParams.duration }),
      });
      const appointment = await handler.mutations.scheduleAppointment({
        appointmentParams,
        requestHeaders: generateRequestHeaders(user.authId),
      });

      const result = await handler.queries.getUserSlots({
        appointmentId: appointment.id,
        notBefore: add(startOfToday(), { hours: 10 }),
        ...additionalGetSlotsParams,
      });

      expect(result.slots.length).toBe(expectedDefaultSlots);
    });

    it('should get user slots', async () => {
      const user = await creators.createAndValidateUser();
      const { member } = await creators.createMemberUserAndOptionalOrg();

      await handler.mutations.createAvailabilities({
        requestHeaders: generateRequestHeaders(user.authId),
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

    it('should getUsers with existing members count', async () => {
      const { user: user1 } = await creators.createMemberUserAndOptionalOrg();
      const { user: user2 } = await creators.createMemberUserAndOptionalOrg();
      const { member: member1 } = await creators.createMemberUserAndOptionalOrg();
      const { member: member2 } = await creators.createMemberUserAndOptionalOrg();
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams: { memberId: member1.id, userId: user1.id },
      });
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams: { memberId: member2.id, userId: user1.id },
      });

      const noMembersUser = await creators.createAndValidateUser();
      const primaryUser = await handler.queries.getUser({
        requestHeaders: generateRequestHeaders(user1.authId),
      });
      const singlePrimaryUser = await handler.queries.getUser({
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      const users = await handler.queries.getUsers();
      const primaryUserResult = users.filter((user) => user.id === user1.id)[0];
      const singlePrimaryUserResult = users.filter((user) => user.id === user2.id)[0];
      const noMembersUserResult = users.filter((user) => user.id === noMembersUser.id)[0];

      expect({ currentMembersCount: 3, isEnabled: true, ...primaryUser }).toMatchObject(
        primaryUserResult,
      );
      expect({ currentMembersCount: 0, isEnabled: true, ...noMembersUser }).toMatchObject(
        noMembersUserResult,
      );
      expect({ currentMembersCount: 1, isEnabled: true, ...singlePrimaryUser }).toMatchObject(
        singlePrimaryUserResult,
      );
    }, 10000);
  });

  describe('discharge links', () => {
    it('should be able to get upload discharge links of a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const result = await handler.queries.getMemberUploadDischargeDocumentsLinks({
        id: member.id,
      });

      expect(result).toEqual({
        dischargeNotesLink: 'https://some-url/upload',
        dischargeInstructionsLink: 'https://some-url/upload',
      });
    });

    it('should be able to get download discharge links of a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const result = await handler.queries.getMemberDownloadDischargeDocumentsLinks({
        id: member.id,
      });

      expect(result).toEqual({
        dischargeNotesLink: 'https://some-url/download',
        dischargeInstructionsLink: 'https://some-url/download',
      });
    });
  });

  describe('notes', () => {
    it('should create update and delete appointment notes', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const scheduledAppointment = generateScheduleAppointmentParams({
        memberId: member.id,
        userId: member.primaryUserId.toString(),
        method: AppointmentMethod.chat,
      });
      const { id: appointmentId } = await creators.handler.mutations.scheduleAppointment({
        appointmentParams: scheduledAppointment,
      });
      let appointment = await creators.handler.queries.getAppointment({ id: appointmentId });

      expect(appointment.notes).toBeNull();

      let updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment({ id: appointment.id });

      expect(appointment.notes).toMatchObject(updateNotesParams.notes);

      updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment({ id: appointment.id });

      expect(appointment.notes).toMatchObject(updateNotesParams.notes);

      updateNotesParams = generateUpdateNotesParams({ appointmentId: appointment.id, notes: null });
      await handler.mutations.updateNotes({ updateNotesParams });
      appointment = await creators.handler.queries.getAppointment({ id: appointment.id });

      expect(appointment.notes).toBeNull();
    });

    it('should be able to set note for and nurseNotes for a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: member.id });
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams });

      const memberResult = await handler.queries.getMember({
        id: member.id,
        requestHeaders: generateRequestHeaders(member.authId),
      });
      expect(memberResult.generalNotes).toEqual(setGeneralNotesParams.note);
      expect(memberResult.nurseNotes).toEqual(setGeneralNotesParams.nurseNotes);
    });

    it('should accept empty note or nurseNotes for a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const params1 = generateSetGeneralNotesParams({
        memberId: member.id,
        note: '',
      });
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams: params1 });

      const requestHeaders = generateRequestHeaders(member.authId);
      const result1 = await handler.queries.getMember({ id: member.id, requestHeaders });
      expect(result1.generalNotes).toEqual(params1.note);
      expect(result1.nurseNotes).toEqual(params1.nurseNotes);

      const params2 = generateSetGeneralNotesParams({
        memberId: member.id,
        nurseNotes: '',
      });
      await creators.handler.mutations.setGeneralNotes({ setGeneralNotesParams: params2 });

      const result2 = await handler.queries.getMember({ id: member.id, requestHeaders });
      expect(result2.generalNotes).toEqual(params2.note);
      expect(result2.nurseNotes).toEqual(params2.nurseNotes);
    });
  });

  describe('drg', () => {
    it('should return the default path for a non existing drg on getMemberConfig', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const memberConfig = await handler.queries.getMemberConfig({
        id: member.id,
        requestHeaders: generateRequestHeaders(member.authId),
      });
      expect(memberConfig.articlesPath).toEqual(articlesByDrg.default);
    });

    it('should return the configured path for a configured drg on getMemberConfig', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const updateMemberParams = generateUpdateMemberParams({ id: member.id, drg: '123' });
      await handler.mutations.updateMember({ updateMemberParams });

      const memberConfig = await handler.queries.getMemberConfig({
        id: member.id,
        requestHeaders: generateRequestHeaders(updateMemberParams.authId),
      });
      expect(memberConfig.articlesPath).toEqual(articlesByDrg['123']);
    });

    it('should set phoneType and phoneSecondaryType', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const updateMemberParams = generateUpdateMemberParams({ id: member.id, drg: '123' });
      await handler.mutations.updateMember({ updateMemberParams });

      const memberResult = await handler.queries.getMember({
        id: member.id,
        requestHeaders: generateRequestHeaders(updateMemberParams.authId),
      });
      expect(memberResult.phoneType).toEqual('mobile');
      expect(memberResult.phoneSecondaryType).toEqual('mobile');
    });
  });

  describe('recordings', () => {
    it('should be able to get upload recordings of a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const result = await handler.queries.getMemberUploadRecordingLink({
        recordingLinkParams: {
          memberId: member.id,
          id: `${lorem.word()}.mp4`,
        },
      });
      expect(result).toEqual('https://some-url/upload');
    });

    it('should be able to get download recordings of a member', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();

      const result = await handler.queries.getMemberDownloadRecordingLink({
        recordingLinkParams: {
          memberId: member.id,
          id: `${lorem.word()}.mp4`,
        },
      });
      expect(result).toEqual('https://some-url/download');
    });

    it('should update recordings for multiple members and get those recordings', async () => {
      const compareRecording = (rec1: RecordingOutput, rec2: Recording, userId: string) => {
        expect(rec1.id).toEqual(rec2.id);
        expect(rec1.userId).toEqual(userId);
        expect(rec1.start).toEqual(rec2.start);
        expect(rec1.end).toEqual(rec2.end);
        expect(rec1.answered).toEqual(rec2.answered);
        expect(rec1.phone).toEqual(rec2.phone);
      };

      const { member: member1, user: user1 } = await creators.createMemberUserAndOptionalOrg();
      const { member: member2, user: user2 } = await creators.createMemberUserAndOptionalOrg();

      const requestHeadersUser1 = generateRequestHeaders(user1.authId);
      const requestHeadersUser2 = generateRequestHeaders(user2.authId);
      const params1a = generateUpdateRecordingParams({ memberId: member1.id });
      const rec1a = await handler.mutations.updateRecording({
        updateRecordingParams: params1a,
        requestHeaders: requestHeadersUser1,
      });
      let result1 = await handler.queries.getRecordings({ memberId: member1.id });
      compareRecording(result1[0], rec1a, member1.primaryUserId.toString());

      //overriding existing recording with different params
      const params1b = generateUpdateRecordingParams({ memberId: member1.id, id: rec1a.id });
      const rec1b = await handler.mutations.updateRecording({
        updateRecordingParams: params1b,
        requestHeaders: requestHeadersUser1,
      });
      result1 = await handler.queries.getRecordings({
        memberId: member1.id,
      });
      compareRecording(result1[0], rec1b, member1.primaryUserId.toString());

      const params1c = generateUpdateRecordingParams({ memberId: member1.id });
      const rec1c = await handler.mutations.updateRecording({
        updateRecordingParams: params1c,
        requestHeaders: requestHeadersUser1,
      });

      const params2 = generateUpdateRecordingParams({ memberId: member2.id, id: v4() });
      const rec2 = await handler.mutations.updateRecording({
        updateRecordingParams: params2,
        requestHeaders: requestHeadersUser2,
      });

      result1 = await handler.queries.getRecordings({ memberId: member1.id });
      expect(result1.length).toEqual(2);
      compareRecording(result1[0], rec1b, member1.primaryUserId.toString());
      compareRecording(result1[1], rec1c, member1.primaryUserId.toString());
      const result2 = await handler.queries.getRecordings({ memberId: member2.id });
      expect(result2.length).toEqual(1);
      compareRecording(result2[0], rec2, member2.primaryUserId.toString());
    });

    it('should delete recordings and media files on unconsented appointment end', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
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
    it('set/get a dailyReport sorted by date', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      // start randomly and collect 3 dates:
      const startDate = date.past();
      const day1 = reformatDate(startDate.toString(), general.get('dateFormatString'));
      const day2 = reformatDate(
        add(startDate, { days: 2 }).toString(),
        general.get('dateFormatString'),
      );
      const day3 = reformatDate(
        add(startDate, { days: 4 }).toString(),
        general.get('dateFormatString'),
      );

      // upload 3 daily reports
      await Promise.all(
        [
          {
            date: day1,
            categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
          },
          {
            date: day3,
            categories: [{ category: DailyReportCategoryTypes.Mobility, rank: 1 }],
          },
          {
            date: day2,
            categories: [{ category: DailyReportCategoryTypes.Appetite, rank: 2 }],
          },
        ].map(async (report) =>
          handler.mutations.setDailyReportCategories({
            requestHeaders,
            dailyReportCategoriesInput: report,
          }),
        ),
      );

      // fetch daily reports for the member
      const dailyReports = await handler.queries.getDailyReports({
        dailyReportQueryInput: {
          startDate: day1,
          endDate: day3,
          memberId: member.id,
        } as DailyReportQueryInput,
      });

      // expect to get reports in chronological order
      expect(dailyReports).toMatchObject({
        data: [
          {
            categories: [{ category: DailyReportCategoryTypes.Pain, rank: 1 }],
            date: day1,
            statsOverThreshold: [DailyReportCategoryTypes.Pain],
            memberId: member.id,
          },
          {
            categories: [{ category: DailyReportCategoryTypes.Appetite, rank: 2 }],
            date: day2,
            statsOverThreshold: [DailyReportCategoryTypes.Appetite],
            memberId: member.id,
          },
          {
            categories: [{ category: DailyReportCategoryTypes.Mobility, rank: 1 }],
            date: day3,
            statsOverThreshold: [DailyReportCategoryTypes.Mobility],
            memberId: member.id,
          },
        ],
        metadata: { minDate: reformatDate(day1.toString(), general.get('dateFormatString')) },
      });
    });
  });

  describe('Journal', () => {
    it('should create get update and delete member journal', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);
      const { id: journalId } = await handler.mutations.createJournal({ requestHeaders });
      const journalBeforeUpdate = await handler.queries.getJournal({
        id: journalId,
        requestHeaders,
      });

      expect(journalBeforeUpdate).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: null,
      });

      const updateJournalTextParams: UpdateJournalTextParams = generateUpdateJournalTextParams({
        id: journalId,
      });
      const journalAfterUpdate = await handler.mutations.updateJournalText({
        requestHeaders,
        updateJournalTextParams,
      });

      expect(journalAfterUpdate).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: updateJournalTextParams.text,
      });

      const journals = await handler.queries.getJournals({ requestHeaders });

      expect(journals[0]).toMatchObject({
        id: journalId,
        memberId: member.id,
        published: false,
        text: updateJournalTextParams.text,
      });

      await handler.mutations.deleteJournal({ id: journalId, requestHeaders });
      await handler.queries.getJournal({
        requestHeaders,
        id: journalId,
        invalidFieldsError: Errors.get(ErrorType.memberJournalNotFound),
      });
    });
  });

  describe('Alerts', () => {
    let member1: Member,
      member2: Member,
      notification1,
      notification2,
      notification3,
      requestHeadersUser,
      internationalization: Internationalization;

    beforeAll(async () => {
      // Fixtures: generate 2 members with the same primary user
      const { member, user, org } = await creators.createMemberUserAndOptionalOrg();
      member1 = member;
      const { id } = await handler.mutations.createMember({
        memberParams: generateCreateMemberParams({ orgId: org.id, userId: user.id }),
      });
      member2 = await handler.queries.getMember({ id });
      requestHeadersUser = generateRequestHeaders(user.authId);

      notification1 = mockGenerateDispatch({
        dispatchId: v4(),
        senderClientId: member1.id,
        contentKey: AppointmentInternalKey.appointmentScheduledUser,
      });
      notification2 = mockGenerateDispatch({
        sentAt: sub(notification1.sentAt, { hours: 1 }),
        senderClientId: member2.id,
        contentKey: LogInternalKey.memberNotFeelingWellMessage,
      });
      // should be ignored.. over 30 days
      notification3 = mockGenerateDispatch({
        sentAt: sub(new Date(), { days: 30 }),
        senderClientId: member2.id,
        contentKey: LogInternalKey.memberNotFeelingWellMessage,
      });

      internationalization = new Internationalization();
      await internationalization.onModuleInit();
    });

    beforeEach(() => {
      handler.notificationService.spyOnNotificationServiceGetDispatchesByClientSenderId.mockReset();
      // Notification service to return expected response
      // eslint-disable-next-line max-len
      handler.notificationService.spyOnNotificationServiceGetDispatchesByClientSenderId.mockResolvedValueOnce(
        [notification1],
      );
      // eslint-disable-next-line max-len
      handler.notificationService.spyOnNotificationServiceGetDispatchesByClientSenderId.mockResolvedValueOnce(
        [notification2, notification3],
      );
    });

    it('should get alerts', async () => {
      const alerts = await handler.queries.getAlerts({ requestHeaders: requestHeadersUser });

      expect(alerts).toEqual([
        {
          date: member2.createdAt,
          dismissed: false,
          id: `${member2.id}_${AlertType.memberAssigned}`,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberAssigned, { member: member2 }),
          memberId: member2.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: member1.createdAt,
          dismissed: false,
          id: `${member1.id}_${AlertType.memberAssigned}`,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberAssigned, { member: member1 }),
          memberId: member1.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: notification1.sentAt.toISOString(),
          dismissed: false,
          id: notification1.dispatchId,
          isNew: true,
          text: internationalization.getAlerts(AlertType.appointmentScheduledUser, {
            member: member1,
          }),
          memberId: member1.id.toString(),
          type: AlertType.appointmentScheduledUser,
        },
        {
          date: notification2.sentAt.toISOString(),
          dismissed: false,
          id: notification2.dispatchId,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberNotFeelingWellMessage, {
            member: member2,
          }),
          memberId: member2.id.toString(),
          type: AlertType.memberNotFeelingWellMessage,
        },
      ]);
    });

    it('should get alerts with dismissed indication', async () => {
      // User will dismiss one alert - we should expect to see the alert as dismissed
      await handler.mutations.dismissAlert({
        alertId: notification1.dispatchId,
        requestHeaders: requestHeadersUser,
      });

      const alerts = await handler.queries.getAlerts({ requestHeaders: requestHeadersUser });

      expect(alerts).toEqual([
        {
          date: member2.createdAt,
          dismissed: false,
          id: `${member2.id}_${AlertType.memberAssigned}`,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberAssigned, {
            member: member2,
          }),
          memberId: member2.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: member1.createdAt,
          dismissed: false,
          id: `${member1.id}_${AlertType.memberAssigned}`,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberAssigned, {
            member: member1,
          }),
          memberId: member1.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: notification1.sentAt.toISOString(),
          dismissed: true,
          id: notification1.dispatchId,
          isNew: true,
          text: internationalization.getAlerts(AlertType.appointmentScheduledUser, {
            member: member1,
          }),
          memberId: member1.id.toString(),
          type: AlertType.appointmentScheduledUser,
        },
        {
          date: notification2.sentAt.toISOString(),
          dismissed: false,
          id: notification2.dispatchId,
          isNew: true,
          text: internationalization.getAlerts(AlertType.memberNotFeelingWellMessage, {
            member: member2,
          }),
          memberId: member2.id.toString(),
          type: AlertType.memberNotFeelingWellMessage,
        },
      ]);
    });

    it('should get alerts with isNew set to false after setLastQueryAlert', async () => {
      // User setLastQueryAlert to now
      await handler.mutations.setLastQueryAlert({ requestHeaders: requestHeadersUser });
      await handler.queries.getUser({ requestHeaders: requestHeadersUser });

      const alerts = await handler.queries // .setContextUserId(primaryUser, undefined, [UserRole.coach], lastQueryAlert)
        .getAlerts({ requestHeaders: requestHeadersUser });

      expect(alerts).toEqual([
        {
          date: member2.createdAt,
          dismissed: false,
          id: `${member2.id}_${AlertType.memberAssigned}`,
          isNew: false,
          text: internationalization.getAlerts(AlertType.memberAssigned, {
            member: member2,
          }),
          memberId: member2.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: member1.createdAt,
          dismissed: false,
          id: `${member1.id}_${AlertType.memberAssigned}`,
          isNew: false,
          text: internationalization.getAlerts(AlertType.memberAssigned, {
            member: member1,
          }),
          memberId: member1.id.toString(),
          type: AlertType.memberAssigned,
        },
        {
          date: notification1.sentAt.toISOString(),
          dismissed: true,
          id: notification1.dispatchId,
          isNew: false,
          text: internationalization.getAlerts(AlertType.appointmentScheduledUser, {
            member: member1,
          }),
          memberId: member1.id.toString(),
          type: AlertType.appointmentScheduledUser,
        },
        {
          date: notification2.sentAt.toISOString(),
          dismissed: false,
          id: notification2.dispatchId,
          isNew: false,
          text: internationalization.getAlerts(AlertType.memberNotFeelingWellMessage, {
            member: member2,
          }),
          memberId: member2.id.toString(),
          type: AlertType.memberNotFeelingWellMessage,
        },
      ]);
    });

    it('should get alerts with todos', async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const memberId = member.id;

      const createTodoByUserParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
      });

      const { id: todoIdByUser } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createTodoParams: createTodoByUserParams,
      });

      const createTodoByMemberParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
      });

      const { id: todoIdByMember } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(member.authId),
        createTodoParams: createTodoByMemberParams,
      });

      const alerts = await handler.queries.getAlerts({
        requestHeaders: generateRequestHeaders(user.authId),
      });

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `${todoIdByMember}_${AlertType.memberCreateTodo}`,
            type: AlertType.memberCreateTodo,
            text: internationalization.getAlerts(AlertType.memberCreateTodo, {
              member,
              todoText: createTodoByMemberParams.text,
            }),
            memberId,
            dismissed: false,
            isNew: true,
          }),
        ]),
      );
      expect(alerts).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({
            id: `${todoIdByUser}_${AlertType.memberCreateTodo}`,
            type: AlertType.memberCreateTodo,
            text: internationalization.getAlerts(AlertType.memberCreateTodo, {
              member,
              todoText: createTodoByUserParams.text,
            }),
            memberId,
            dismissed: false,
            isNew: true,
          }),
        ]),
      );
    });
  });

  describe('Caregiver', () => {
    it('should add, get, update and delete a member caregiver', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const requestHeaders = generateRequestHeaders(member.authId);

      // Add:
      const addCaregiverParams = generateAddCaregiverParams({ memberId: member.id });

      const caregiver = await handler.mutations.addCaregiver({
        addCaregiverParams,
        requestHeaders,
      });

      expect(caregiver).toMatchObject(addCaregiverParams);

      // Get:
      let persistedCaregivers = await handler.queries.getCaregivers({
        requestHeaders,
        memberId: member.id,
      });

      expect(persistedCaregivers).toMatchObject([addCaregiverParams]);

      // Update:
      const updateCaregiverParams = generateUpdateCaregiverParams({
        id: persistedCaregivers[0].id,
        memberId: member.id,
      });

      const updatedCaregiver = await handler.mutations.updateCaregiver({
        requestHeaders,
        updateCaregiverParams: updateCaregiverParams,
      });

      expect(updatedCaregiver).toMatchObject(updateCaregiverParams);

      // Delete:
      const status = await handler.mutations.deleteCaregiver({
        requestHeaders,
        id: updatedCaregiver.id,
      });

      expect(status).toBeTruthy();

      // Get (confirm record was deleted):
      persistedCaregivers = await handler.queries.getCaregivers({
        memberId: member.id,
      });

      expect(
        persistedCaregivers.find((caregiver) => caregiver.id === updatedCaregiver.id),
      ).toBeFalsy();

      expect(status).toBeTruthy();
    }, 10000);
  });

  describe('Appointments', () => {
    it('should delete a scheduled appointment', async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();

      const appointment = await appointmentsActions.requestAppointment({
        userId: user.id,
        member,
      });

      await handler.mutations.deleteAppointment({ id: appointment.id });

      expect(await handler.queries.getAppointment({ id: appointment.id })).toBeFalsy();
    }, 10000);
  });

  describe('Todos', () => {
    it('should create end and delete Todo', async () => {
      /**
       * 1. User creates a todo for member
       * 2. Member update todo
       * 3. create TodoDone
       * 4. delete TodoDone
       * 5. User ends the todo
       */
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const memberId = member.id;

      const requestHeadersUser = generateRequestHeaders(user.authId);
      const requestHeadersMember = generateRequestHeaders(member.authId);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: requestHeadersUser,
        createTodoParams,
      });

      const todos = await handler.queries.getTodos({
        memberId,
        requestHeaders: requestHeadersMember,
      });

      expect(todos.length).toEqual(1);
      expect(todos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            start: createTodoParams.start.toISOString(),
            end: createTodoParams.end.toISOString(),
            status: TodoStatus.active,
            createdBy: user.id,
            updatedBy: user.id,
          }),
        ]),
      );

      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({ id });
      const newCreatedTodo = await handler.mutations.updateTodo({
        updateTodoParams,
        requestHeaders: requestHeadersMember,
      });

      const todosAfterUpdate = await handler.queries.getTodos({
        memberId,
        requestHeaders: requestHeadersUser,
      });

      expect(todosAfterUpdate.length).toEqual(2);
      expect(todosAfterUpdate).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            start: createTodoParams.start.toISOString(),
            end: updateTodoParams.start.toISOString(),
            status: TodoStatus.updated,
            createdBy: user.id,
            updatedBy: memberId,
          }),
          expect.objectContaining({
            ...updateTodoParams,
            id: newCreatedTodo.id,
            memberId,
            start: updateTodoParams.start.toISOString(),
            end: updateTodoParams.end.toISOString(),
            status: TodoStatus.active,
            relatedTo: id,
            createdBy: user.id,
            updatedBy: memberId,
          }),
        ]),
      );

      const createTodoDoneParams1: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: newCreatedTodo.id,
      });
      const createTodoDoneParams2: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: newCreatedTodo.id,
      });
      delete createTodoDoneParams1.memberId;
      delete createTodoDoneParams2.memberId;

      const { id: todoDoneId1 } = await handler.mutations.createTodoDone({
        createTodoDoneParams: createTodoDoneParams1,
        requestHeaders: requestHeadersMember,
      });
      const { id: todoDoneId2 } = await handler.mutations.createTodoDone({
        createTodoDoneParams: createTodoDoneParams2,
        requestHeaders: requestHeadersMember,
      });

      expect(todoDoneId1).not.toBeUndefined();
      expect(todoDoneId2).not.toBeUndefined();

      const getTodoDonesParams = generateGetTodoDonesParams({ memberId });

      const TodoDones = await handler.queries.getTodoDones({
        getTodoDonesParams,
        requestHeaders: requestHeadersMember,
      });

      expect(TodoDones.length).toEqual(2);
      expect(TodoDones).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: todoDoneId1,
            memberId,
            todoId: newCreatedTodo.id,
            done: createTodoDoneParams1.done.toISOString(),
          }),
          expect.objectContaining({
            id: todoDoneId2,
            memberId,
            todoId: newCreatedTodo.id,
            done: createTodoDoneParams2.done.toISOString(),
          }),
        ]),
      );

      await handler.mutations.deleteTodoDone({
        id: todoDoneId1,
        requestHeaders: requestHeadersMember,
      });

      const TodoDonesAfterDelete = await handler.queries.getTodoDones({
        getTodoDonesParams,
        requestHeaders: requestHeadersMember,
      });

      expect(TodoDonesAfterDelete.length).toEqual(1);
      expect(TodoDonesAfterDelete).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: todoDoneId2,
            memberId,
            todoId: newCreatedTodo.id,
            done: createTodoDoneParams2.done.toISOString(),
          }),
        ]),
      );

      const endTodo = await handler.mutations.endTodo({
        id: newCreatedTodo.id,
        requestHeaders: requestHeadersUser,
      });

      expect(endTodo).toBeTruthy();

      const todosAfterEnd = await handler.queries.getTodos({
        memberId,
        requestHeaders: requestHeadersUser,
      });

      expect(todosAfterEnd.length).toEqual(2);
      expect(todosAfterEnd).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            start: createTodoParams.start.toISOString(),
            end: updateTodoParams.start.toISOString(),
            status: TodoStatus.updated,
            createdBy: user.id,
            updatedBy: memberId,
          }),
          expect.objectContaining({
            ...updateTodoParams,
            id: newCreatedTodo.id,
            memberId,
            start: updateTodoParams.start.toISOString(),
            end: updateTodoParams.end.toISOString(),
            status: TodoStatus.ended,
            createdBy: user.id,
            updatedBy: user.id,
          }),
        ]),
      );
    }, 10000);

    it('should create and end an scheduled todo', async () => {
      const { member } = await creators.createMemberUserAndOptionalOrg();
      const memberId = member.id;
      const requestHeaders = generateRequestHeaders(member.authId);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
      });
      delete createTodoParams.cronExpressions;
      delete createTodoParams.start;
      delete createTodoParams.end;

      const { id } = await handler.mutations.createTodo({ requestHeaders, createTodoParams });

      const todos = await handler.queries.getTodos({ requestHeaders, memberId });

      expect(todos.length).toEqual(1);
      expect(todos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            status: TodoStatus.active,
            createdBy: memberId,
            updatedBy: memberId,
          }),
        ]),
      );

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: id,
      });
      delete createTodoDoneParams.memberId;

      await handler.mutations.createTodoDone({ requestHeaders, createTodoDoneParams });

      const todosAfterDone = await handler.queries.getTodos({ requestHeaders, memberId });

      expect(todosAfterDone.length).toEqual(1);
      expect(todosAfterDone).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            status: TodoStatus.ended,
            createdBy: memberId,
            updatedBy: memberId,
          }),
        ]),
      );
    });

    it('should create requested todo and approve it', async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const memberId = member.id;
      const requestHeaders = generateRequestHeaders(member.authId);

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId,
        label: TodoLabel.Meds,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(user.authId),
        createTodoParams,
      });

      const todos = await handler.queries.getTodos({ requestHeaders, memberId });
      expect(todos.length).toEqual(1);
      expect(todos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            start: createTodoParams.start.toISOString(),
            end: createTodoParams.end.toISOString(),
            status: TodoStatus.requested,
            createdBy: user.id,
            updatedBy: user.id,
          }),
        ]),
      );

      await handler.mutations.approveTodo({ requestHeaders, id });

      const todosAfterApproving = await handler.queries.getTodos({ requestHeaders, memberId });
      expect(todosAfterApproving).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...createTodoParams,
            id,
            start: createTodoParams.start.toISOString(),
            end: createTodoParams.end.toISOString(),
            status: TodoStatus.active,
            createdBy: user.id,
            updatedBy: memberId,
          }),
        ]),
      );
    });

    it('should fail to delete TodoDone of another member', async () => {
      const { member: member1 } = await creators.createMemberUserAndOptionalOrg();
      const { member: member2 } = await creators.createMemberUserAndOptionalOrg();

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: member1.id,
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(member1.authId),
        createTodoParams,
      });

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: id,
      });
      delete createTodoDoneParams.memberId;

      const { id: todoDoneId } = await handler.mutations.createTodoDone({
        requestHeaders: generateRequestHeaders(member1.authId),
        createTodoDoneParams,
      });

      await handler.mutations.deleteTodoDone({
        requestHeaders: generateRequestHeaders(member2.authId),
        id: todoDoneId,
        invalidFieldsErrors: [Errors.get(ErrorType.todoDoneNotFound)],
      });
    });
  });

  describe('Care', () => {
    describe('red flag', () => {
      it('should get red flag types', async () => {
        const availableRedFlagTypes = await handler.queries.getRedFlagTypes();
        const { description, id } = handler.redFlagType;
        expect(availableRedFlagTypes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id,
              description,
            }),
          ]),
        );
      });

      it('should update a red flag', async () => {
        const {
          member: { id: memberId },
        } = await creators.createMemberUserAndOptionalOrg();
        await submitMockCareWizard(handler, memberId);
        const memberRedFlags = await handler.queries.getMemberRedFlags({
          memberId,
        });
        expect(memberRedFlags.length).toEqual(1);
        const redFlagId = memberRedFlags[0].id;

        const updateRedFlagParams = generateUpdateRedFlagParams({
          id: redFlagId,
          notes: 'new notes',
        });
        const result = await handler.mutations.updateRedFlag({
          updateRedFlagParams,
        });
        expect(result).toBeTruthy();

        // get again to verify the update
        const updatedMemberRedFlags = await handler.queries.getMemberRedFlags({
          memberId,
        });
        expect(memberRedFlags.length).toEqual(1);

        expect(updatedMemberRedFlags).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...memberRedFlags[0],
              notes: 'new notes',
            }),
          ]),
        );
      });
    });

    describe('barrier', () => {
      it('should get barrier types', async () => {
        const availableBarrierTypes = await handler.queries.getBarrierTypes();
        const { description, domain, id } = handler.barrierType;
        expect(availableBarrierTypes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id,
              description,
              domain,
              carePlanTypes: expect.arrayContaining([
                expect.objectContaining({ id: handler.carePlanType.id }),
              ]),
            }),
          ]),
        );
      });

      it('should update a barrier', async () => {
        const {
          member: { id: memberId },
          user: { authId },
        } = await creators.createMemberUserAndOptionalOrg();
        await submitMockCareWizard(handler, memberId);
        const memberBarriers = await handler.queries.getMemberBarriers({
          memberId,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(memberBarriers.length).toEqual(1);
        const barrierId = memberBarriers[0].id;

        const updateBarrierParams = generateUpdateBarrierParams({
          id: barrierId,
          notes: 'new notes',
          status: CareStatus.completed,
        });
        const result = await handler.mutations.updateBarrier({
          updateBarrierParams,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(result).toBeTruthy();

        // get again to verify the update
        const updatedMemberBarriers = await handler.queries.getMemberBarriers({
          memberId,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(memberBarriers.length).toEqual(1);

        expect(updatedMemberBarriers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...memberBarriers[0],
              notes: 'new notes',
              status: CareStatus.completed,
            }),
          ]),
        );
      });
    });

    describe('care plan', () => {
      it('should get care plan types', async () => {
        const availableCarePlanTypes = await handler.queries.getCarePlanTypes();
        const { description, isCustom, id } = handler.carePlanType;
        expect(availableCarePlanTypes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              description,
              isCustom,
              id,
            }),
          ]),
        );
      });

      it('should update a care plan', async () => {
        const {
          member: { id: memberId },
          user: { authId },
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
          status: CareStatus.completed,
        });
        const result = await handler.mutations.updateCarePlan({
          updateCarePlanParams,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(result).toBeTruthy();

        // get again to verify the update
        const updatedMemberCarePlans = await handler.queries.getMemberCarePlans({
          memberId,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(memberCarePlans.length).toEqual(1);

        expect(updatedMemberCarePlans).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...memberCarePlans[0],
              notes: updateCarePlanParams.notes,
              status: updateCarePlanParams.status,
              dueDate: updateCarePlanParams.dueDate.toISOString(),
            }),
          ]),
        );
      });

      it('should create an additional care plan to an existing barrier', async () => {
        const {
          member: { id: memberId },
          user: { authId },
        } = await creators.createMemberUserAndOptionalOrg();
        await submitMockCareWizard(handler, memberId);

        const memberBarriers = await handler.queries.getMemberBarriers({
          memberId,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(memberBarriers.length).toEqual(1);
        const barrierId = memberBarriers[0].id;

        const createCarePlanParams: CreateCarePlanParams = generateCreateCarePlanParams({
          memberId,
          barrierId,
          type: generateCarePlanTypeInput({ id: handler.carePlanType.id }),
        });

        const { id } = await handler.mutations.createCarePlan({
          createCarePlanParams,
          requestHeaders: generateRequestHeaders(authId),
        });

        // get again to verify the update
        const memberCarePlans = await handler.queries.getMemberCarePlans({
          memberId,
          requestHeaders: generateRequestHeaders(authId),
        });
        expect(memberCarePlans.length).toEqual(2);

        expect(memberCarePlans).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ...createCarePlanParams,
              dueDate: createCarePlanParams.dueDate.toISOString(),
              type: expect.objectContaining({ id: handler.carePlanType.id }),
              id,
            }),
          ]),
        );
      });

      it('should delete a care plan', async () => {
        const {
          member: { id: memberId },
        } = await creators.createMemberUserAndOptionalOrg();
        await submitMockCareWizard(handler, memberId);

        const memberCarePlans = await handler.queries.getMemberCarePlans({
          memberId,
        });
        expect(memberCarePlans.length).toEqual(1);
        const carePlanId = memberCarePlans[0].id;

        await handler.mutations.deleteCarePlan({ id: carePlanId });

        const memberCarePlansAfter = await handler.queries.getMemberCarePlans({
          memberId,
        });
        expect(memberCarePlansAfter.length).toEqual(0);
      });
    });

    it("should create care wizard result and get all member's data", async () => {
      // setup - creating a tree structure representing the care wizard result:
      // red flag -> barrier1 -> carePlan1
      //                      -> carePlan2
      //          -> barrier2 -> carePlan3
      const {
        member: { id: memberId },
        user: { authId },
      } = await creators.createMemberUserAndOptionalOrg();
      const carePlanTypeInput1 = generateCarePlanTypeInput({ id: handler.carePlanType.id });
      const customDescription = lorem.words(4);
      const carePlanTypeInput2 = generateCarePlanTypeInput({ custom: customDescription });
      const carePlan1 = generateCreateCarePlanParamsWizard({ type: carePlanTypeInput1 });
      const carePlan2 = generateCreateCarePlanParamsWizard({ type: carePlanTypeInput2 });
      const carePlan3 = generateCreateCarePlanParamsWizard({ type: carePlanTypeInput1 });
      const barrier1 = generateCreateBarrierParamsWizard({
        type: handler.barrierType.id,
        carePlans: [carePlan1, carePlan2],
      });
      const barrier2 = generateCreateBarrierParamsWizard({
        type: handler.barrierType.id,
        carePlans: [carePlan3],
      });
      const redFlag = generateCreateRedFlagParamsWizard({
        barriers: [barrier1, barrier2],
        type: handler.redFlagType.id,
      });
      const wizardParams = generateSubmitCareWizardParams({ redFlag, memberId });
      const result = await handler.mutations.submitCareWizard({
        submitCareWizardParams: wizardParams,
        requestHeaders: generateRequestHeaders(authId),
      });
      expect(result.ids.length).toEqual(3);

      // get all member's red flags, barriers and care plans
      const memberRedFlags = await handler.queries.getMemberRedFlags({
        memberId,
        requestHeaders: generateRequestHeaders(authId),
      });
      expect(memberRedFlags.length).toEqual(1);

      const memberBarriers = await handler.queries.getMemberBarriers({
        memberId,
        requestHeaders: generateRequestHeaders(authId),
      });
      expect(memberBarriers.length).toEqual(2);

      const memberCarePlans = await handler.queries.getMemberCarePlans({
        memberId,
        requestHeaders: generateRequestHeaders(authId),
      });
      expect(memberCarePlans.length).toEqual(3);

      // *test the result and the relations between the entities*
      // test red flag
      delete redFlag.barriers;
      expect(memberRedFlags).toEqual([
        expect.objectContaining({
          ...redFlag,
          type: expect.objectContaining({ id: handler.redFlagType.id }),
          memberId,
        }),
      ]);
      const memberRedFlag = memberRedFlags[0];

      // test barriers
      delete barrier1.carePlans;
      delete barrier2.carePlans;
      expect(memberBarriers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...barrier1,
            memberId,
            redFlagId: memberRedFlag.id,
            type: expect.objectContaining({ id: handler.barrierType.id }),
          }),
          expect.objectContaining({
            ...barrier2,
            memberId,
            redFlagId: memberRedFlag.id,
            type: expect.objectContaining({ id: handler.barrierType.id }),
          }),
        ]),
      );

      // test the new custom care plan
      const carePlanTypes = await handler.queries.getCarePlanTypes();
      expect(carePlanTypes).toEqual(
        expect.arrayContaining([expect.objectContaining({ description: customDescription })]),
      );
      const { id: createdCarePlanType } = carePlanTypes.find(
        (i) => i.description === customDescription,
      );

      // test care plans
      expect(memberCarePlans).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...carePlan1,
            dueDate: carePlan1.dueDate.toISOString(),
            memberId,
            type: expect.objectContaining({ id: handler.carePlanType.id }),
          }),
          expect.objectContaining({
            ...carePlan2,
            dueDate: carePlan2.dueDate.toISOString(),
            memberId,
            type: expect.objectContaining({ id: createdCarePlanType }),
          }),
          expect.objectContaining({
            ...carePlan3,
            dueDate: carePlan3.dueDate.toISOString(),
            memberId,
            type: expect.objectContaining({ id: handler.carePlanType.id }),
          }),
        ]),
      );

      // test matching the right plans of care to the right barriers
      const memberCarePlan1 = memberCarePlans.find((i) => i.notes === carePlan1.notes);
      const memberCarePlan2 = memberCarePlans.find((i) => i.notes === carePlan2.notes);
      const memberCarePlan3 = memberCarePlans.find((i) => i.notes === carePlan3.notes);
      expect(memberCarePlan1.barrierId).toEqual(memberCarePlan2.barrierId);
      expect(memberBarriers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: memberCarePlan1.barrierId }),
          expect.objectContaining({ id: memberCarePlan3.barrierId }),
        ]),
      );

      expect(result.ids.sort()).toEqual(
        memberCarePlans.map((carePlan) => carePlan.id.toString()).sort(),
      );
    });
  });

  describe('Questionnaire', () => {
    it('should create, get and submit questionnaires', async () => {
      const { member, user, org } = await creators.createMemberUserAndOptionalOrg();

      const createQuestionnaireParams: CreateQuestionnaireParams =
        generateCreateQuestionnaireParams({
          type: QuestionnaireType.phq9, // type of form to calculate a score
          shortName: 'PHQ-9',
          items: [
            mockGenerateQuestionnaireItem({
              type: ItemType.choice,
              code: 'q1',
              options: [
                { label: lorem.words(3), value: 0 },
                { label: lorem.words(3), value: 1 },
                { label: lorem.words(3), value: 2 },
              ],
            }),
          ],
          notificationScoreThreshold: 2,
        });

      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams,
      });

      // Get All Active Questionnaires
      const questionnaires = await handler.queries.getActiveQuestionnaires();

      expect(questionnaires.length).toBeGreaterThanOrEqual(1);
      expect(
        questionnaires.find((questionnaire) => questionnaire.id === questionnaireId),
      ).toBeTruthy();

      // Get a questionnaire by id
      const questionnaire = await handler.queries.getQuestionnaire({ id: questionnaireId });

      expect(questionnaire).toBeTruthy();
      expect(questionnaire.id).toEqual(questionnaireId);

      const spyOnEventEmitter = jest.spyOn(handler.eventEmitter, 'emit');

      // Submit a questionnaire response
      let qr = await handler.mutations.submitQuestionnaireResponse({
        requestHeaders: generateRequestHeaders(user.authId),
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId,
          memberId: member.id,
          answers: [{ code: 'q1', value: '2' }],
        }),
      });

      await delay(500); // wait for the last emit to complete (sending alert to slack channel)

      expect(spyOnEventEmitter).toHaveBeenLastCalledWith(GlobalEventType.notifySlack, {
        channel: 'slack.escalation',
        header: `*High Assessment Score [${org.name}]*`,
        icon: ':warning:',
        // eslint-disable-next-line max-len
        message:
          `Alerting results on ${questionnaire.shortName} for ` +
          `${user.firstName} ${user.lastName}’s member - ` +
          `<${hosts.harmony}/details/${member.id.toString()}|` +
          `${member.firstName[0].toUpperCase() + member.lastName[0].toUpperCase()}>` +
          `. Scored a '2'`,
      });

      expect(qr.id).toBeTruthy();

      // Get a questionnaire response (by id)
      qr = await handler.queries.getQuestionnaireResponse({ id: qr.id });

      expect(qr.id).toBeTruthy();

      // Get questionnaire responses (by member id)
      const qrs = await handler.queries.getMemberQuestionnaireResponses({ memberId: member.id });

      expect(qrs.length).toEqual(1);
      expect(qrs.find((qrItem) => qrItem.id === qr.id)).toBeTruthy();
    });

    // eslint-disable-next-line max-len
    it(`should create, get, submit and get health persona from a ${QuestionnaireType.lhp} questionnaire`, async () => {
      const { member, user } = await creators.createMemberUserAndOptionalOrg();
      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams: buildLHPQuestionnaire(),
      });

      await handler.mutations.submitQuestionnaireResponse({
        requestHeaders: generateRequestHeaders(user.authId),
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId,
          memberId: member.id,
          answers: [
            { code: 'q1', value: '2' },
            { code: 'q2', value: '4' },
          ],
        }),
      });

      await delay(200);

      const result = await handler.queries.getMember({ id: member.id });
      expect(result.healthPersona).toEqual(
        Object.keys(HealthPersona).find((key) => HealthPersona[key] === HealthPersona.highEffort),
      );

      const qrs = await handler.queries.getMemberQuestionnaireResponses({ memberId: member.id });
      const res = qrs.find((qr) => qr.type === QuestionnaireType.lhp);
      expect(res.result.severity).toEqual(HealthPersona.highEffort);
    });
  });

  it('should update user related channels on updated user', async () => {
    const { user, org } = await creators.createMemberUserAndOptionalOrg();
    await handler.mutations.createMember({
      memberParams: generateCreateMemberParams({ orgId: org.id, userId: user.id }),
    }); //generating another member for the specific user above

    handler.sendBird.spyOnSendBirdUpdateChannelName.mockReset();
    handler.sendBird.spyOnSendBirdUpdateUser.mockReset();

    const updatedUser = { ...mockGenerateUser(), id: user.id };
    const eventParams: IEventOnUpdatedUser = { user: updatedUser };
    handler.eventEmitter.emit(EventType.onUpdatedUser, eventParams);

    await delay(1000);
    expect(handler.sendBird.spyOnSendBirdUpdateUser).toBeCalledWith({
      nickname: `${updatedUser.firstName} ${updatedUser.lastName}`,
      profile_url: updatedUser.avatar,
      user_id: updatedUser.id,
    });

    const calls = [1, 2];
    expect(handler.sendBird.spyOnSendBirdUpdateChannelName).toBeCalledTimes(calls.length);
    calls.map((call) => {
      expect(handler.sendBird.spyOnSendBirdUpdateChannelName).toHaveBeenNthCalledWith(
        call,
        expect.any(String),
        `${updatedUser.firstName} ${updatedUser.lastName}`,
        updatedUser.avatar,
      );
    });
  });

  it('should update only primary user related channels on updated user', async () => {
    const user1 = await creators.createAndValidateUser();
    const { user: user2, member } = await creators.createMemberUserAndOptionalOrg();

    /**
     * adding user1 to member and user2 sendbird channel
     * after schedule app, there will be a sendbird channel with member and both user1 and user2
     */
    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: user1.id,
    });

    await creators.handler.mutations.scheduleAppointment({ appointmentParams });

    await delay(500);

    handler.sendBird.spyOnSendBirdUpdateChannelName.mockReset();
    handler.sendBird.spyOnSendBirdUpdateUser.mockReset();

    const updatedUser = { ...mockGenerateUser(), id: user2.id };
    const eventParams: IEventOnUpdatedUser = { user: updatedUser };
    handler.eventEmitter.emit(EventType.onUpdatedUser, eventParams);

    await delay(1000);

    expect(handler.sendBird.spyOnSendBirdUpdateUser).toBeCalledWith({
      nickname: `${updatedUser.firstName} ${updatedUser.lastName}`,
      profile_url: updatedUser.avatar,
      user_id: updatedUser.id,
    });

    expect(handler.sendBird.spyOnSendBirdUpdateChannelName).toBeCalledWith(
      expect.any(String),
      `${updatedUser.firstName} ${updatedUser.lastName}`,
      updatedUser.avatar,
    );
  });

  it('should not update secondary user related channels on updated user', async () => {
    const user = await creators.createAndValidateUser();
    const { member } = await creators.createMemberUserAndOptionalOrg();

    /**
     * adding user1 to member and user2 sendbird channel
     * after schedule app, there will be a sendbird channel with member and both user1 and user2
     */
    const appointmentParams = generateScheduleAppointmentParams({
      memberId: member.id,
      userId: user.id,
    });

    await creators.handler.mutations.scheduleAppointment({ appointmentParams });

    await delay(500);

    handler.sendBird.spyOnSendBirdUpdateChannelName.mockReset();
    handler.sendBird.spyOnSendBirdUpdateUser.mockReset();

    const updatedUser = { ...mockGenerateUser(), id: user.id };
    const eventParams: IEventOnUpdatedUser = { user: updatedUser };
    handler.eventEmitter.emit(EventType.onUpdatedUser, eventParams);

    await delay(500);

    expect(handler.sendBird.spyOnSendBirdUpdateUser).toBeCalledWith({
      nickname: `${updatedUser.firstName} ${updatedUser.lastName}`,
      profile_url: updatedUser.avatar,
      user_id: updatedUser.id,
    });

    expect(handler.sendBird.spyOnSendBirdUpdateChannelName).not.toBeCalled();
  });

  it('should update a user', async () => {
    const { id, authId } = await creators.createAndValidateUser();

    const updateUserParams = generateUpdateUserParams({ id });
    const updateUserResponse = await handler.mutations.updateUser({
      updateUserParams,
      requestHeaders: handler.defaultAdminRequestHeaders,
    });

    const getResponse = await handler.queries.getUser({
      requestHeaders: generateRequestHeaders(authId),
    });

    expect(getResponse).toEqual(expect.objectContaining(updateUserResponse));
  });

  it('should graduate and ungraduate a member', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();
    const deviceId = v4();
    await handler.mutations.updateMember({ updateMemberParams: { id: member.id, deviceId } });

    const graduate = async (isGraduated: boolean, calledMethod, notCalledMethod) => {
      const currentTime = new Date();

      await handler.mutations.graduateMember({
        graduateMemberParams: { id: member.id, isGraduated },
      });

      const memberAfter = await handler.queries.getMember({ id: member.id });
      expect(memberAfter.isGraduated).toEqual(isGraduated);

      if (isGraduated) {
        expect(Date.parse(memberAfter.graduationDate)).toBeGreaterThanOrEqual(
          currentTime.getTime(),
        );
      } else {
        expect(memberAfter.graduationDate).toBeFalsy();
      }

      expect(calledMethod).toBeCalledWith(deviceId);
      expect(notCalledMethod).not.toBeCalled();
      calledMethod.mockReset();
      notCalledMethod.mockReset();
    };

    const { spyOnCognitoServiceDisableClient, spyOnCognitoServiceEnableClient } =
      handler.cognitoService;
    await graduate(true, spyOnCognitoServiceDisableClient, spyOnCognitoServiceEnableClient);
    await graduate(false, spyOnCognitoServiceEnableClient, spyOnCognitoServiceDisableClient);
  });

  it('should create 2 member admissions and get them', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    const { result: result1 } = await changeMemberAdmission(ChangeType.create, member.id);
    const { result: result2 } = await changeMemberAdmission(ChangeType.create, member.id);

    const memberAdmissions = await handler.queries.getMemberAdmissions({
      memberId: member.id.toString(),
    });

    const checkInternals = {
      diagnoses: expect.arrayContaining([
        expect.objectContaining({ description: expect.any(String) }),
      ]),
      procedures: expect.arrayContaining([expect.objectContaining({ text: expect.any(String) })]),
      medications: expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]),
      externalAppointments: expect.arrayContaining([
        expect.objectContaining({ description: expect.any(String) }),
      ]),
      activities: expect.arrayContaining([expect.objectContaining({ text: expect.any(String) })]),
      woundCares: expect.arrayContaining([expect.objectContaining({ text: expect.any(String) })]),
      dietaries: expect.arrayContaining([expect.objectContaining({ text: expect.any(String) })]),
    };

    expect(memberAdmissions.length).toEqual(2);
    expect(memberAdmissions).toEqual([
      expect.objectContaining({ id: result1.id, ...checkInternals }),
      expect.objectContaining({ id: result2.id, ...checkInternals }),
    ]);
  });

  it('should create and update member admission', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();

    //create all admission params
    const { changeAdmissionParams: createAdmissionParams, result: createResult } =
      await changeMemberAdmission(ChangeType.create, member.id);

    const diagnoses = [
      { id: createResult.diagnoses[0].id, ...removeChangeType(createAdmissionParams.diagnosis) },
    ];
    const procedures = [
      {
        id: createResult.procedures[0].id,
        ...removeChangeType(createAdmissionParams.procedure),
        date: createAdmissionParams.procedure.date.toISOString(),
      },
    ];
    const medications = [
      {
        id: createResult.medications[0].id,
        ...removeChangeType(createAdmissionParams.medication),
        startDate: createAdmissionParams.medication.startDate.toISOString(),
        endDate: createAdmissionParams.medication.endDate.toISOString(),
      },
    ];
    const externalAppointments = [
      {
        id: createResult.externalAppointments[0].id,
        ...removeChangeType(createAdmissionParams.externalAppointment),
        date: createAdmissionParams.externalAppointment.date.toISOString(),
      },
    ];
    const activities = [
      { id: createResult.activities[0].id, ...removeChangeType(createAdmissionParams.activity) },
    ];
    const woundCares = [
      { id: createResult.woundCares[0].id, ...removeChangeType(createAdmissionParams.woundCare) },
    ];
    const dietaries = [
      { id: createResult.dietaries[0].id, ...removeChangeType(createAdmissionParams.dietary) },
    ];

    expect(createResult).toEqual(
      expect.objectContaining({
        id: createResult.id,
        diagnoses,
        procedures,
        medications,
        externalAppointments,
        activities,
        woundCares,
        dietaries,
      }),
    );

    //update/delete some admission params
    const changeAdmissionParams: ChangeAdmissionParams = {
      id: createResult.id.toString(),
      memberId: member.id,
      procedure: generateAdmissionProcedureParams({
        changeType: ChangeType.update,
        id: createResult.procedures[0].id,
      }),
      medication: generateAdmissionMedicationParams({
        changeType: ChangeType.delete,
        id: createResult.medications[0].id,
      }),
      activity: generateAdmissionActivityParams({ changeType: ChangeType.create }),
    };
    const changeResult = await handler.mutations.changeMemberAdmission({ changeAdmissionParams });

    procedures[0] = {
      id: createResult.procedures[0].id,
      ...removeChangeType(changeAdmissionParams.procedure),
      date: changeAdmissionParams.procedure.date.toISOString(),
    };
    activities[1] = {
      id: changeResult.activities[1].id,
      ...removeChangeType(changeAdmissionParams.activity),
    };

    expect(changeResult).toEqual(
      expect.objectContaining({
        id: createResult.id,
        diagnoses,
        procedures,
        medications: [],
        externalAppointments,
        activities,
        woundCares,
        dietaries,
      }),
    );
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
    const user = await creators.createAndValidateUser();
    const availabilities = Array.from(Array(count)).map(() => generateAvailabilityInput());
    const requestHeaders = generateRequestHeaders(user.authId);

    const { ids } = await handler.mutations.createAvailabilities({
      requestHeaders,
      availabilities,
    });

    expect(ids.length).toEqual(availabilities.length);

    const availabilitiesResult = await handler.queries.getAvailabilities({ requestHeaders });
    const resultFiltered = availabilitiesResult.filter(
      (availability) => availability.userId === user.id,
    );

    expect(resultFiltered.length).toEqual(availabilities.length);

    return { ids };
  };

  const createTodos = async (memberId: string, requestHeaders) => {
    const createTodoParams = generateCreateTodoParams({ memberId });
    const { id: todoId } = await handler.mutations.createTodo({ createTodoParams, requestHeaders });
    const createTodoDoneParams = generateCreateTodoDoneParams({ todoId, done: new Date() });
    delete createTodoDoneParams.memberId;
    await handler.mutations.createTodoDone({ createTodoDoneParams, requestHeaders });
    const todos = await handler.queries.getTodos({ memberId, requestHeaders });
    expect(todos).toHaveLength(1);
    const todoDones = await handler.queries.getTodoDones({
      requestHeaders,
      getTodoDonesParams: {
        memberId,
        start: createTodoParams.start,
        end: createTodoParams.end,
      },
    });
    expect(todoDones).toHaveLength(1);
  };

  const submitQR = async (memberId: string) => {
    // Create a template:
    const createQuestionnaireParams: CreateQuestionnaireParams = generateCreateQuestionnaireParams({
      type: QuestionnaireType.phq9, // type of form to calculate a score
      shortName: 'PHQ-9',
      items: [
        mockGenerateQuestionnaireItem({
          type: ItemType.choice,
          code: 'q1',
          options: [
            { label: lorem.words(3), value: 0 },
            { label: lorem.words(3), value: 1 },
            { label: lorem.words(3), value: 2 },
          ],
        }),
      ],
      notificationScoreThreshold: 2,
    });

    const { id: questionnaireId } = await handler.mutations // .setContextUserId(userId, '', [UserRole.admin])
      .createQuestionnaire({
        createQuestionnaireParams,
      });

    // Submit a questionnaire response
    await handler.mutations // .setContextUserId(userId, '', [UserRole.nurse])
      .submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: generateSubmitQuestionnaireResponseParams({
          questionnaireId,
          memberId,
          answers: [{ code: 'q1', value: '2' }],
        }),
      });
  };

  const changeMemberAdmission = async (
    changeType: ChangeType,
    memberId: string,
  ): Promise<{ changeAdmissionParams: ChangeAdmissionParams; result: MemberAdmission }> => {
    const createDiagnosis = generateAdmissionDiagnosisParams({ changeType });
    const createProcedure = generateAdmissionProcedureParams({ changeType });
    const createMedication = generateAdmissionMedicationParams({ changeType });
    const createExternalAppointment = generateAdmissionExternalAppointmentParams({ changeType });
    const createActivity = generateAdmissionActivityParams({ changeType });
    const createWoundCare = generateAdmissionWoundCareParams({ changeType });
    const createDietary = generateAdmissionDietaryParams({ changeType });

    const changeAdmissionParams: ChangeAdmissionParams = {
      memberId,
      diagnosis: createDiagnosis,
      procedure: createProcedure,
      medication: createMedication,
      externalAppointment: createExternalAppointment,
      activity: createActivity,
      woundCare: createWoundCare,
      dietary: createDietary,
    };

    const result = await handler.mutations.changeMemberAdmission({
      changeAdmissionParams,
    });

    return { changeAdmissionParams, result };
  };
});
