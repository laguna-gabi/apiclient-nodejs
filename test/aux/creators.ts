import { CreateUserParams, User, UserRole } from '../../src/user';
import {
  generateAppointmentLink,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateEndAppointmentParams,
  generateOrgParams,
} from '../generators';
import { camelCase, omit } from 'lodash';
import { Org } from '../../src/org';
import { CreateTaskParams, defaultMemberParams, Member } from '../../src/member';
import { Appointment, AppointmentStatus, EndAppointmentParams } from '../../src/appointment';
import { Handler } from './handler';
import { AppointmentsIntegrationActions } from './appointments';
import { Types } from 'mongoose';
import { delay } from '../common';

export class Creators {
  constructor(
    readonly handler: Handler,
    private readonly appointmentsActions: AppointmentsIntegrationActions,
  ) {}

  createAndValidateUser = async (roles?: UserRole[]): Promise<User> => {
    const userParams: CreateUserParams = generateCreateUserParams({ roles });
    const { id: primaryUserId } = await this.handler.mutations.createUser({ userParams });

    const result = await this.handler.queries.getUser(primaryUserId);

    const expectedUser = {
      ...userParams,
      id: primaryUserId,
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
    primaryUser,
    users,
  }: {
    org: Org;
    primaryUser: User;
    users: User[];
  }): Promise<Member> => {
    const memberParams = generateCreateMemberParams({
      orgId: org.id,
    });
    const usersIds = users.map((i) => i.id);
    const { id } = await this.handler.mutations.createMember({ memberParams });
    await delay(1000);
    await this.handler.memberModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id) },
      { $set: { primaryUserId: primaryUser.id, users: usersIds } },
      { upsert: true, new: true, rawResult: true },
    );

    const member = await this.handler.queries.getMember({ id });

    expect(member.phone).toEqual(memberParams.phone);
    expect(member.firstName).toEqual(memberParams.firstName);
    expect(member.lastName).toEqual(memberParams.lastName);

    expect(new Date(member.dateOfBirth)).toEqual(new Date(memberParams.dateOfBirth));
    expect(member.primaryUserId).toEqual(primaryUser.id);
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
   * 5. call endAppointment a few times (checks for 'override' endAppointmentParams)
   * 6. call query getAppointment: returned current appointment with all fields
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

    const appointment = await this.appointmentsActions.scheduleAppointment(userId, member);
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
