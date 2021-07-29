import { CreateUserParams, User, UserRole } from '../../../src/user';
import {
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateMemberLinks,
  generateNotesParams,
  generateOrgParams,
} from '../../generators';
import { camelCase, omit } from 'lodash';
import { Org } from '../../../src/org';
import { CreateTaskParams, defaultMemberParams, Member } from '../../../src/member';
import * as faker from 'faker';
import { Appointment } from '../../../src/appointment';
import { Handler } from './handler';
import { AppointmentsIntegrationActions } from './appointments';

export class Creators {
  constructor(
    readonly handler: Handler,
    private readonly appointmentsActions: AppointmentsIntegrationActions,
  ) {}

  createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const { id: primaryCoachId } = await this.handler.mutations.createUser({ userParams });

    const result = await this.handler.queries.getUser(primaryCoachId);

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

  createAndValidateOrg = async (): Promise<Org> => {
    const orgParams = generateOrgParams();
    const { id } = await this.handler.mutations.createOrg({ orgParams });

    expect(id).not.toBeUndefined();

    return { id, ...orgParams };
  };

  createAndValidateMember = async ({
    org,
    primaryCoach,
    coaches = [],
  }: {
    org: Org;
    primaryCoach: User;
    coaches?: User[];
  }): Promise<Member> => {
    const deviceId = faker.datatype.uuid();
    this.handler.setContextUser(deviceId);

    const memberParams = generateCreateMemberParams({
      deviceId,
      orgId: org.id,
      primaryCoachId: primaryCoach.id,
      usersIds: coaches.map((coach) => coach.id),
    });
    const links = generateMemberLinks(memberParams.firstName, memberParams.lastName);

    await this.handler.mutations.createMember({ memberParams });

    const member = await this.handler.queries.getMember();

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
    expect(new Date(member.createdAt)).toEqual(expect.any(Date));

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
  createAndValidateAppointment = async ({
    userId,
    member,
  }: {
    userId: string;
    member: Member;
  }): Promise<Appointment> => {
    const requestAppointmentResult = await this.appointmentsActions.requestAppointment(
      userId,
      member,
    );

    let appointment = await this.appointmentsActions.scheduleAppointment(userId, member);

    expect(requestAppointmentResult.id).not.toEqual(appointment.id);

    appointment = await this.appointmentsActions.endAppointment(appointment.id);
    appointment = await this.appointmentsActions.freezeAppointment(appointment.id);
    appointment = await this.appointmentsActions.endAppointment(appointment.id); //Unfreeze
    appointment = await this.appointmentsActions.showAppointment(appointment.id);

    let notes = generateNotesParams();
    await this.handler.mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    let result = await this.handler.queries.getAppointment(appointment.id);

    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

    notes = generateNotesParams(2);
    await this.handler.mutations.setNotes({ params: { appointmentId: appointment.id, ...notes } });
    result = await this.handler.queries.getAppointment(appointment.id);
    expect(result).toEqual({ ...appointment, updatedAt: result.updatedAt, notes });

    return result;
  };

  createAndValidateTask = async (
    memberId: string,
    method,
  ): Promise<{ id: string; createTaskParams: CreateTaskParams }> => {
    const createTaskParams = generateCreateTaskParams({ memberId });
    const { id } = await method({ createTaskParams });
    expect(id).toEqual(expect.any(String));

    return { id, createTaskParams };
  };
}
