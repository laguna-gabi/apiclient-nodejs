import { camelCase, omit } from 'lodash';
import { Appointment, AppointmentStatus, EndAppointmentParams } from '../../src/appointment';
import { CreateTaskParams, Member, defaultMemberParams } from '../../src/member';
import { Org } from '../../src/org';
import { CreateUserParams, User } from '../../src/user';
import {
  generateAppointmentLink,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateEndAppointmentParams,
  generateOrgParams,
} from '..';
import { AppointmentsIntegrationActions, Handler } from '.';
import { UserRole } from '../../src/common';

export class Creators {
  constructor(
    readonly handler: Handler,
    private readonly appointmentsActions: AppointmentsIntegrationActions,
  ) {}

  createFirstUserInDbfNecessary = async () => {
    const users = await this.handler.queries.getUsers();
    if (users.length === 0) {
      await this.createAndValidateUser();
    }
  };

  createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const { id: primaryUserId } = await this.handler.mutations.createUser({ userParams });
    const result = await this.handler.setContextUserId(primaryUserId).queries.getUser();

    const expectedUser = { ...userParams, id: primaryUserId, appointments: [] };

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

  /**
   * @param org
   * @param useNewUser : true if you call scheduleAppointment, in order to avoid error of collision
   * in appointment: ErrorType.appointmentOverlaps : Appointment overlaps another appointment
   */
  createAndValidateMember = async ({
    org,
    useNewUser = false,
    userId, // support the case where we want to assign the member to an existing user
  }: {
    org: Org;
    useNewUser?: boolean;
    userId?: string;
  }): Promise<Member> => {
    const userParams = generateCreateUserParams();

    if (useNewUser) {
      const { id } = await this.handler.mutations.createUser({ userParams });
      userId = id;
    }

    const memberParams = generateCreateMemberParams({ orgId: org.id, userId });
    const { id } = await this.handler.mutations.createMember({ memberParams });

    const member = await this.handler.setContextUserId(id).queries.getMember({ id });

    expect(member.phone).toEqual(memberParams.phone);
    expect(member.phoneType).toEqual('mobile');
    expect(member.firstName).toEqual(memberParams.firstName);
    expect(member.lastName).toEqual(memberParams.lastName);

    expect(new Date(member.dateOfBirth)).toEqual(new Date(memberParams.dateOfBirth));
    expect(member.primaryUserId).toEqual(expect.any(String));
    expect(member.org).toEqual(org);
    expect(member.sex).toEqual(defaultMemberParams.sex);
    expect(member.email).toBeNull();
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
   * 5. call endAppointment a few times (checks for 'override' endAppointmentParams)
   * 6. call query getAppointment: returned current appointment with all fields
   */
  createAndValidateAppointment = async ({
    userId,
    member,
  }: {
    userId?: string;
    member: Member;
  }): Promise<Appointment> => {
    const requestAppointmentResult = await this.appointmentsActions.requestAppointment({
      userId: userId || member.primaryUserId.toString(),
      member,
    });

    const appointment = await this.appointmentsActions.scheduleAppointment({
      userId: userId || member.primaryUserId.toString(),
      member,
    });
    expect(appointment.status).toEqual(AppointmentStatus.scheduled);
    expect(requestAppointmentResult.id).toEqual(appointment.id);

    const executeEndAppointment = async (): Promise<Appointment> => {
      const endAppointmentParams: EndAppointmentParams = generateEndAppointmentParams({
        id: appointment.id,
      });
      const result = await this.handler.mutations.endAppointment({ endAppointmentParams });
      expect(result).toEqual(
        expect.objectContaining({
          status: AppointmentStatus.done,
          link: generateAppointmentLink(appointment.id),
          ...endAppointmentParams,
        }),
      );
      return result;
    };

    await executeEndAppointment();
    await executeEndAppointment();
    return executeEndAppointment(); //triple checking end appointment with params
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
