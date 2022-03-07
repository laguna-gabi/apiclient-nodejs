import * as jwt from 'jsonwebtoken';
import { camelCase, omit } from 'lodash';
import { AppointmentsIntegrationActions, Handler } from '.';
import {
  generateAppointmentLink,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateEndAppointmentParams,
  generateOrgParams,
} from '..';
import { Appointment, AppointmentStatus, EndAppointmentParams } from '../../src/appointment';
import { UserRole } from '../../src/common';
import { CreateTaskParams, Member, defaultMemberParams } from '../../src/member';
import { Org } from '../../src/org';
import { CreateUserParams, User } from '../../src/user';
import { generateRequestHeaders } from '../index';

export class Creators {
  constructor(
    readonly handler: Handler,
    private readonly appointmentsActions: AppointmentsIntegrationActions,
  ) {}

  createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const { id: primaryUserId } = await this.handler.mutations.createUser({ userParams });
    const result = await this.handler.queries.getUser({
      requestHeaders: generateRequestHeaders(userParams.authId),
    });

    const expectedUser = { ...userParams, id: primaryUserId, appointments: [] };

    const resultUserNew = omit(result, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expect.objectContaining(expectedUserNew));
    expect(new Date(resultUserNew.createdAt)).toEqual(expect.any(Date));

    expect(result.roles).toEqual(expectedUser.roles.map((role) => camelCase(role)));

    return result;
  };

  createAndValidateOrg = async ({
    requestHeaders = this.handler.defaultUserRequestHeaders,
  }: { requestHeaders? } = {}): Promise<Org> => {
    const orgParams = generateOrgParams();
    const { id } = await this.handler.mutations.createOrg({ orgParams, requestHeaders });

    expect(id).not.toBeUndefined();

    return { id, ...orgParams };
  };

  createMemberUserAndOptionalOrg = async ({
    orgId,
  }: {
    orgId?: string;
  } = {}): Promise<{ member: Member; user: User; org: Org }> => {
    const org = orgId
      ? await this.handler.queries.getOrg({ id: orgId })
      : await this.createAndValidateOrg();
    const userParams = generateCreateUserParams();
    await this.handler.mutations.createUser({ userParams });
    const user: User = await this.handler.queries.getUser({
      requestHeaders: { Authorization: jwt.sign({ sub: userParams.authId }, 'my-secret') },
    });

    const requestHeaders = this.handler.defaultUserRequestHeaders;
    const memberParams = generateCreateMemberParams({ orgId: org.id, userId: user.id });
    const { id } = await this.handler.mutations.createMember({ memberParams, requestHeaders });

    const member = await this.handler.queries.getMember({ id, requestHeaders });
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

    return { member, user, org };
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
    requestHeaders = this.handler.defaultUserRequestHeaders,
  }: {
    userId?: string;
    member: Member;
    requestHeaders?;
  }): Promise<Appointment> => {
    const requestAppointmentResult = await this.appointmentsActions.requestAppointment({
      requestHeaders,
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
      const result = await this.handler.mutations.endAppointment({
        endAppointmentParams,
        requestHeaders,
      });
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
