import { add, startOfToday, startOfTomorrow } from 'date-fns';
import * as request from 'supertest';
import { AppointmentStatus } from '../../src/appointment';
import { defaultSlotsParams } from '../../src/user';
import { AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import { compareMembers, urls } from '../common';
import {
  generateAvailabilityInput,
  generateCreateMemberParams,
  generateScheduleAppointmentParams,
} from '../generators';
import { generateRequestHeaders } from '../index';

describe('Integration tests: rest', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let server;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    server = handler.app.getHttpServer();
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  it('getSlots', async () => {
    const org = await creators.createAndValidateOrg();
    const { member, user } = await creators.createAndValidateMember({ org, useNewUser: true });
    const requestHeaders = generateRequestHeaders(user.authId);

    const appointment = await creators.createAndValidateAppointment({ member, requestHeaders });

    await handler.mutations.createAvailabilities({
      requestHeaders,
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

    const { body } = await request(server).get(`${urls.slots}/${appointment.id}`).expect(200);
    expect(body).toEqual(
      expect.objectContaining({
        user: {
          id: member.primaryUserId,
          firstName: member.users[0].firstName,
          roles: expect.any(Array),
          avatar: member.users[0].avatar,
          description: member.users[0].description,
        },
        member: { id: member.id, firstName: member.firstName },
        appointment: expect.objectContaining({
          id: appointment.id,
          start: expect.any(String),
          method: appointment.method.toString(),
          duration: defaultSlotsParams.duration.toString(),
        }),
        slots: expect.any(Array),
      }),
    );
  });

  it('scheduleAppointment', async () => {
    const org = await creators.createAndValidateOrg();
    const { member, user } = await creators.createAndValidateMember({ org, useNewUser: true });

    const appointmentsParams = generateScheduleAppointmentParams({
      userId: user.id,
      memberId: member.id,
    });

    const { body } = await request(server)
      .post(urls.scheduleAppointments)
      .send(appointmentsParams)
      .expect(201);

    expect(body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        memberId: member.id,
        userId: user.id,
        method: appointmentsParams.method,
        status: AppointmentStatus.scheduled,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        link: expect.any(String),
      }),
    );

    expect(new Date(body.end)).toEqual(appointmentsParams.end);
    expect(new Date(body.start)).toEqual(appointmentsParams.start);
  });

  it('createMember', async () => {
    const org = await creators.createAndValidateOrg();
    const memberParams = generateCreateMemberParams({ orgId: org.id });

    const {
      body: { id: memberId },
    } = await request(server).post(urls.members).send(memberParams).expect(201);
    // test member created
    const requestHeaders = generateRequestHeaders(memberParams.authId);

    const member = await handler.queries.getMember({ id: memberId, requestHeaders });
    compareMembers(member, memberParams);
    // test member config created
    const memberConfig = await handler.queries.getMemberConfig({ id: memberId, requestHeaders });
    expect(memberConfig.memberId).toEqual(memberId);
  });

  it('createControlMember', async () => {
    handler.featureFlagService.spyOnFeatureFlagControlGroup.mockResolvedValueOnce(true);
    const org = await creators.createAndValidateOrg();
    const memberParams = generateCreateMemberParams({ orgId: org.id });

    const {
      body: { id: memberId },
    } = await request(server).post(urls.members).send(memberParams).expect(201);
    expect(memberId).toEqual(expect.any(String));
  });
});
