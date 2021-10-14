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
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('getSlots', () => {
    it('should get slots', async () => {
      const resultCoach = await creators.createAndValidateUser();

      const resultOrg = await creators.createAndValidateOrg();
      const resultMember = await creators.createAndValidateMember({
        org: resultOrg,
        primaryUser: resultCoach,
        users: [resultCoach],
      });

      const appointment = await creators.createAndValidateAppointment({
        userId: resultCoach.id,
        member: resultMember,
      });

      await handler.mutations.createAvailabilities({
        availabilities: [
          generateAvailabilityInput({
            start: add(startOfToday(), { hours: 10 }),
            end: add(startOfToday(), { hours: 22 }),
            userId: resultCoach.id,
          }),
          generateAvailabilityInput({
            start: add(startOfTomorrow(), { hours: 10 }),
            end: add(startOfTomorrow(), { hours: 22 }),
            userId: resultCoach.id,
          }),
        ],
      });

      const { body } = await request(server).get(`${urls.slots}/${appointment.id}`).expect(200);
      expect(body).toEqual(
        expect.objectContaining({
          user: {
            id: resultCoach.id,
            firstName: resultCoach.firstName,
            roles: expect.any(Array),
            avatar: resultCoach.avatar,
            description: resultCoach.description,
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
      const resultCoach = await creators.createAndValidateUser();

      const resultOrg = await creators.createAndValidateOrg();
      const resultMember = await creators.createAndValidateMember({
        org: resultOrg,
        primaryUser: resultCoach,
        users: [resultCoach],
      });

      const appointmentsParams = generateScheduleAppointmentParams({
        userId: resultCoach.id,
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
          userId: resultCoach.id,
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
