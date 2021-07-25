import {
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateMemberLinks,
  generateNotesParams,
  generateOrgParams,
  generateUpdateMemberParams,
} from '../index';
import { CreateUserParams, User, UserRole } from '../../src/user';
import { camelCase, omit } from 'lodash';
import * as faker from 'faker';
import { CreateTaskParams, defaultMemberParams, Member, Task, TaskState } from '../../src/member';
import { Appointment, AppointmentStatus } from '../../src/appointment';
import { Org } from '../../src/org';
import { Handler } from './aux/handler';
import { AppointmentsIntegrationActions } from './aux/appointments';

describe('Integration tests', () => {
  const handler: Handler = new Handler();
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  it('should be able to call all gql handler.mutations and handler.queries', async () => {
    /**
     * 1. Create a user with a single role - coach
     * 2. Create a user with 2 roles - coach and nurse
     * 3. Create a user with 1 role - nurse
     * 4. Create an organization
     * 5. Create a member in the organization above with the 3 users above.
     *    1st user is the primaryCoach, 2nd and 3rd users is in users list
     * 6. Create an appointment between the primary coach and the member
     * 7. Create an appointment between the non primary coach (2nd user) and the member
     * 8. Create an appointment between the non primary coach (3rd user) and the member
     * 9. Create goals for a member
     * 10. Update goals for a member
     * 11. Create action items for a member
     * 12. Update action items for a member
     * 13. Fetch member and checks all related appointments
     */
    const resultCoach = await createAndValidateUser();
    const resultNurse1 = await createAndValidateUser([UserRole.nurse, UserRole.coach]);
    const resultNurse2 = await createAndValidateUser([UserRole.nurse]);

    const resultOrg = await createAndValidateOrg();
    const resultMember = await createAndValidateMember({
      org: resultOrg,
      primaryCoach: resultCoach,
      coaches: [resultNurse1, resultNurse2],
    });

    const scheduledAppointmentPrimaryCoach = await createAndValidateAppointment({
      userId: resultCoach.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse1 = await createAndValidateAppointment({
      userId: resultNurse1.id,
      member: resultMember,
    });

    const scheduledAppointmentNurse2 = await createAndValidateAppointment({
      userId: resultNurse2.id,
      member: resultMember,
    });

    const { createTaskParams: goal1, id: idGoal1 } = await createAndValidateTask(
      resultMember.id,
      handler.mutations.createGoal,
    );
    const { createTaskParams: goal2, id: idGoal2 } = await createAndValidateTask(
      resultMember.id,
      handler.mutations.createGoal,
    );
    await updateTaskState(idGoal1, handler.mutations.updateGoalState);
    await updateTaskState(idGoal2, handler.mutations.updateGoalState);

    const { createTaskParams: ai1, id: idAi1 } = await createAndValidateTask(
      resultMember.id,
      handler.mutations.createActionItem,
    );
    const { createTaskParams: ai2, id: idAi2 } = await createAndValidateTask(
      resultMember.id,
      handler.mutations.createActionItem,
    );
    await updateTaskState(idAi1, handler.mutations.updateActionItemState);
    await updateTaskState(idAi2, handler.mutations.updateActionItemState);

    const member = await handler.queries.getMember();

    expect(member.primaryCoach.appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentPrimaryCoach).toEqual(
      expect.objectContaining(member.primaryCoach.appointments[1]),
    );

    expect(member.users[0].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentNurse1).toEqual(
      expect.objectContaining(member.users[0].appointments[1]),
    );

    expect(member.users[1].appointments[0]).toEqual(
      expect.objectContaining({ status: AppointmentStatus.requested }),
    );
    expect(scheduledAppointmentNurse2).toEqual(
      expect.objectContaining(member.users[1].appointments[1]),
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
   * 2. member: { id: 'member-123', primaryCoach: { id : 'user-123' } }
   * 3. member: { id: 'member-456', primaryCoach: { id : 'user-123' } }
   * In this case, user has 2 appointments, but when a member requests an appointment,
   * it'll return just the related appointment of a user, and not all appointments.
   */
  it('getAppointments should return just the member appointment of a user', async () => {
    const primaryCoach = await createAndValidateUser();
    const org = await createAndValidateOrg();
    const member1 = await createAndValidateMember({ org, primaryCoach });
    const member2 = await createAndValidateMember({ org, primaryCoach });

    const appointmentMember1 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member1,
    });

    const appointmentMember2 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member2,
    });

    const primaryCoachWithAppointments = await handler.queries.getUser(primaryCoach.id);
    expect(appointmentMember1).toEqual(
      expect.objectContaining(primaryCoachWithAppointments.appointments[1]),
    );
    expect(appointmentMember2).toEqual(
      expect.objectContaining(primaryCoachWithAppointments.appointments[3]),
    );

    handler.setContextUser(member1.deviceId);
    const memberResult1 = await handler.queries.getMember();
    expect(appointmentMember1).toEqual(
      expect.objectContaining(memberResult1.primaryCoach.appointments[1]),
    );

    handler.setContextUser(member2.deviceId);
    const memberResult2 = await handler.queries.getMember();
    expect(appointmentMember2).toEqual(
      expect.objectContaining(memberResult2.primaryCoach.appointments[1]),
    );
  });

  it('should validate that exact member scores are updated on notes.scores update', async () => {
    const primaryCoach = await createAndValidateUser();
    const org = await createAndValidateOrg();
    const member1 = await createAndValidateMember({ org, primaryCoach });
    const member2 = await createAndValidateMember({ org, primaryCoach });

    const appointmentMember1 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member1,
    });

    const appointmentMember2 = await createAndValidateAppointment({
      userId: primaryCoach.id,
      member: member2,
    });

    const notes1 = { appointmentId: appointmentMember1.id, ...generateNotesParams() };
    const notes2 = { appointmentId: appointmentMember2.id, ...generateNotesParams() };
    await handler.mutations.setNotes({ params: notes2 });

    handler.setContextUser(member2.deviceId);
    let member2Result = await handler.queries.getMember();
    expect(member2Result.scores).toEqual(notes2.scores);

    handler.setContextUser(member1.deviceId);
    let member1Result = await handler.queries.getMember();
    expect(member1Result.scores).not.toEqual(member2Result.scores);
    await handler.mutations.setNotes({ params: notes1 });
    member1Result = await handler.queries.getMember();
    expect(member1Result.scores).toEqual(notes1.scores);

    handler.setContextUser(member2.deviceId);
    member2Result = await handler.queries.getMember();
    expect(member2Result.scores).toEqual(notes2.scores);
  });

  it('should update a member fields', async () => {
    const primaryCoach = await createAndValidateUser();
    const org = await createAndValidateOrg();
    const member = await createAndValidateMember({ org, primaryCoach });

    const updateMemberParams = generateUpdateMemberParams({ id: member.id });
    const updatedMemberResult = await handler.mutations.updateMember({ updateMemberParams });

    handler.setContextUser(member.deviceId);
    const memberResult = await handler.queries.getMember();

    expect(memberResult).toEqual(expect.objectContaining(updatedMemberResult));
  });

  /************************************************************************************************
   *************************************** Internal methods ***************************************
   ***********************************************************************************************/

  const createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const { id: primaryCoachId } = await handler.mutations.createUser({ userParams });

    const result = await handler.queries.getUser(primaryCoachId);

    const expectedUser = {
      ...userParams,
      id: primaryCoachId,
      appointments: [],
    };

    const resultUserNew = omit(result, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expect.objectContaining(expectedUserNew));
    expect(new Date(resultUserNew.createdAt)).toEqual(expect.any(Date));

    expect(result.roles).toEqual(expectedUser.roles.map((role) => camelCase(role)));

    return result;
  };

  const createAndValidateOrg = async (): Promise<Org> => {
    const orgParams = generateOrgParams();
    const { id } = await handler.mutations.createOrg({ orgParams });

    expect(id).not.toBeUndefined();

    return { id, ...orgParams };
  };

  const createAndValidateMember = async ({
    org,
    primaryCoach,
    coaches = [],
  }: {
    org: Org;
    primaryCoach: User;
    coaches?: User[];
  }): Promise<Member> => {
    const deviceId = faker.datatype.uuid();
    handler.setContextUser(deviceId);

    const memberParams = generateCreateMemberParams({
      deviceId,
      orgId: org.id,
      primaryCoachId: primaryCoach.id,
      usersIds: coaches.map((coach) => coach.id),
    });
    const links = generateMemberLinks(memberParams.firstName, memberParams.lastName);

    await handler.mutations.createMember({ memberParams });

    const member = await handler.queries.getMember();

    expect(member.phoneNumber).toEqual(memberParams.phoneNumber);
    expect(member.deviceId).toEqual(deviceId);
    expect(member.firstName).toEqual(memberParams.firstName);
    expect(member.lastName).toEqual(memberParams.lastName);

    expect(new Date(member.dateOfBirth)).toEqual(new Date(memberParams.dateOfBirth));
    expect(member.primaryCoach).toEqual(primaryCoach);
    expect(member.users).toEqual(coaches);
    expect(member.dischargeNotesLink).toEqual(links.dischargeNotesLink);
    expect(member.dischargeInstructionsLink).toEqual(links.dischargeInstructionsLink);
    expect(member.org).toEqual(org);
    expect(member.sex).toEqual(defaultMemberParams.sex);
    expect(member.email).toBeNull();
    expect(member.language).toEqual(defaultMemberParams.language);
    expect(member.zipcode).toBeUndefined();
    expect(member.dischargeDate).toBeNull();

    return member;
  };

  /**
   * 1. call mutation requestAppointment: created appointment with memberId, userId, notBefore
   * 2. call query getAppointment: returned current appointment with memberId, userId,
   *                               notBefore and status: requested
   * 3. call mutation scheduleAppointment: created new scheduled appointment with status: scheduled
   * 4. call mutation endAppointment: returned current appointment with status: done
   * 5. call mutation freezeAppointment: returned current appointment with status: closed
   * 6. call mutation endAppointment: "unfreeze" returned current appointment with status: done
   * 7. call setNotes 2 times - 2nd time should override the 1st one
   * 8. call query getAppointment: returned current appointment with all fields
   */
  const createAndValidateAppointment = async ({
    userId,
    member,
  }: {
    userId: string;
    member: Member;
  }): Promise<Appointment> => {
    const requestAppointmentResult = await appointmentsActions.requestAppointment(userId, member);

    let appointment = await appointmentsActions.scheduleAppointment(userId, member);

    expect(requestAppointmentResult.id).not.toEqual(appointment.id);

    appointment = await appointmentsActions.endAppointment(appointment.id);
    appointment = await appointmentsActions.freezeAppointment(appointment.id);
    appointment = await appointmentsActions.endAppointment(appointment.id); //Unfreeze
    appointment = await appointmentsActions.showAppointment(appointment.id);

    let notes = generateNotesParams();
    await handler.mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    let result = await handler.queries.getAppointment(appointment.id);

    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

    notes = generateNotesParams(2);
    await handler.mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    result = await handler.queries.getAppointment(appointment.id);
    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

    return result;
  };

  const createAndValidateTask = async (
    memberId: string,
    method,
  ): Promise<{ id: string; createTaskParams: CreateTaskParams }> => {
    const createTaskParams = generateCreateTaskParams({ memberId });
    const { id } = await method({ createTaskParams });
    expect(id).toEqual(expect.any(String));

    return { id, createTaskParams };
  };

  const updateTaskState = async (id: string, method) => {
    const updateTaskStateParams = { id, state: TaskState.reached };
    await method({ updateTaskStateParams });
  };

  const compareTasks = (task: Task, createTaskParams: CreateTaskParams) => {
    expect(task.title).toEqual(createTaskParams.title);
    expect(task.state).toEqual(TaskState.reached);
    expect(new Date(task.deadline)).toEqual(createTaskParams.deadline);
  };
});
