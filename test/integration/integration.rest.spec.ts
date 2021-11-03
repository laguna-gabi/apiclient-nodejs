import { add, startOfToday, startOfTomorrow } from 'date-fns';
import * as request from 'supertest';
import { AppointmentStatus } from '../../src/appointment';
import { defaultSlotsParams } from '../../src/user';
import { AppointmentsIntegrationActions } from '../aux/appointments';
import { Creators } from '../aux/creators';
import { Handler } from '../aux/handler';
import { urls } from '../common';
import {
  generateAvailabilityInput,
  generateCreateMemberParams,
  generateScheduleAppointmentParams,
} from '../generators';

describe('Integration tests: rest', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let server;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(handler.mutations);
    creators = new Creators(handler, appointmentsActions);
    server = handler.app.getHttpServer();
    handler.mockCommunication();
    await creators.createFirstUserInDbfNecessary();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('getSlots', () => {
    it('should get slots', async () => {
      const resultOrg = await creators.createAndValidateOrg();
      const resultMember = await creators.createAndValidateMember({ org: resultOrg });
      const user = await handler.setContextUserId(resultMember.primaryUserId).queries.getUser();

      const appointment = await creators.createAndValidateAppointment({ member: resultMember });

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

      const { body } = await request(server).get(`${urls.slots}/${appointment.id}`).expect(200);
      expect(body).toEqual(
        expect.objectContaining({
          user: {
            id: resultMember.primaryUserId,
            firstName: resultMember.users[0].firstName,
            roles: expect.any(Array),
            avatar: resultMember.users[0].avatar,
            description: resultMember.users[0].description,
          },
          member: {
            id: resultMember.id,
            firstName: resultMember.firstName,
          },
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
  });

  describe('scheduleAppointment', () => {
    it('should schedule an appointment via rest', async () => {
      const resultOrg = await creators.createAndValidateOrg();
      const resultMember = await creators.createAndValidateMember({ org: resultOrg });

      const appointmentsParams = generateScheduleAppointmentParams({
        userId: resultMember.primaryUserId,
        memberId: resultMember.id,
      });

      const { body } = await request(server)
        .post(urls.scheduleAppointments)
        .send(appointmentsParams)
        .expect(201);

      expect(body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          memberId: resultMember.id,
          userId: resultMember.primaryUserId,
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
  });

  describe('createMember', () => {
    it('should create a member', async () => {
      const org = await creators.createAndValidateOrg();
      const memberParams = generateCreateMemberParams({
        orgId: org.id,
      });

      const { body } = await request(server).post(urls.members).send(memberParams).expect(201);
      expect(body).toEqual({ id: expect.any(String) });
    });
  });
});
