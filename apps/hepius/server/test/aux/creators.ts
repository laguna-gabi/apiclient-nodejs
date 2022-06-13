import { camelCase, omit } from 'lodash';
import { v4 } from 'uuid';
import { AppointmentsIntegrationActions, Handler } from '.';
import {
  generateAppointmentLink,
  generateCreateMemberParams,
  generateCreateOrSetActionItemParams,
  generateCreateUserParams,
  generateEndAppointmentParams,
  generateOrgParams,
  generateRequestHeaders,
} from '..';
import { EndAppointmentParams } from '../../src/appointment';
import { Member, defaultMemberParams } from '../../src/member';
import { Org } from '../../src/org';
import { CreateUserParams } from '../../src/user';
import { Appointment, AppointmentStatus, User, UserRole } from '@argus/hepiusClient';

export class Creators {
  constructor(
    readonly handler: Handler,
    private readonly appointmentsActions: AppointmentsIntegrationActions,
  ) {}

  createAndValidateUser = async ({
    roles,
    orgId,
  }: { roles?: UserRole[]; orgId?: string } = {}): Promise<User> => {
    const createUserParams: CreateUserParams = generateCreateUserParams({
      roles,
      ...(orgId ? { orgs: [orgId] } : {}),
    });

    this.handler.cognitoService.spyOnCognitoServiceAddUser.mockResolvedValueOnce({
      authId: v4(),
      username: v4(),
    });
    const user = await this.handler.mutations.createUser({ createUserParams });
    const result = await this.handler.queries.getUser({
      requestHeaders: generateRequestHeaders(user.authId),
    });

    const expectedUser = {
      ...createUserParams,
      id: user.id,
      appointments: [],
      authId: user.authId,
      username: result.username,
    };

    const resultUserNew = omit(result, 'roles');
    const expectedUserNew = omit(expectedUser, 'roles');
    expect(resultUserNew).toEqual(expect.objectContaining(expectedUserNew));
    expect(new Date(resultUserNew.createdAt)).toEqual(expect.any(Date));

    expect(result.roles).toEqual(expectedUser.roles.map((role) => camelCase(role)));

    return result;
  };

  createAndValidateOrg = async ({
    requestHeaders = this.handler.defaultAdminRequestHeaders,
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
    const createUserParams = generateCreateUserParams({ orgs: [org.id] });
    this.handler.cognitoService.spyOnCognitoServiceAddUser.mockResolvedValueOnce({
      authId: v4(),
      username: v4(),
    });
    const response = await this.handler.mutations.createUser({ createUserParams });
    const user: User = await this.handler.queries.getUser({
      requestHeaders: generateRequestHeaders(response.authId),
    });

    const requestHeaders = this.handler.defaultUserRequestHeaders;
    const memberParams = generateCreateMemberParams({ orgId: org.id, userId: user.id });
    const { id } = await this.handler.createMemberWithRetries({ memberParams });

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
    expect(member.zipCode).toEqual(memberParams.zipCode);
    expect(member.dischargeDate).toBeNull();
    expect(member.maritalStatus).toEqual(memberParams.maritalStatus);
    expect(new Date(member.createdAt)).toEqual(expect.any(Date));
    expect(member.height).toEqual(memberParams.height);
    expect(member.weight).toEqual(memberParams.weight);

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

  createAndValidateActionItem = async (memberId: string): Promise<{ id: string }> => {
    const createOrSetActionItemParams = generateCreateOrSetActionItemParams({ memberId });
    const { id } = await this.handler.mutations.createOrSetActionItem({
      createOrSetActionItemParams,
    });
    expect(id).toEqual(expect.any(String));

    return { id };
  };
}
