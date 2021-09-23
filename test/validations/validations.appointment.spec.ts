import {
  generateEndAppointmentParams,
  generateId,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
  urls,
  generateUpdateNotesParams,
} from '../index';
import * as faker from 'faker';
import { EndAppointmentParams, RequestAppointmentParams } from '../../src/appointment';
import { Errors, ErrorType } from '../../src/common';
import { Handler } from '../aux/handler';
import * as request from 'supertest';

const stringError = `String cannot represent a non string value`;
const floatError = `Float cannot represent non numeric value`;

describe('Validations - appointment', () => {
  const handler: Handler = new Handler();
  let server;

  beforeAll(async () => {
    await handler.beforeAll();
    server = handler.app.getHttpServer();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('request', () => {
    test.each`
      field          | error
      ${'userId'}    | ${`Field "userId" of required type "String!" was not provided.`}
      ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'notBefore'} | ${`Field "notBefore" of required type "DateTime!" was not provided.`}
    `(
      `should fail to create an appointment since mandatory field $field is missing`,
      async (params) => {
        const appointmentParams: RequestAppointmentParams = generateRequestAppointmentParams();
        delete appointmentParams[params.field];
        await handler.mutations.requestAppointment({
          appointmentParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field          | input                                | error
      ${'memberId'}  | ${{ memberId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${'userId'}    | ${{ userId: 123 }}                   | ${{ missingFieldError: stringError }}
      ${'notBefore'} | ${{ notBefore: faker.lorem.word() }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDate)] }}
    `(
      /* eslint-enable max-len */
      `should fail to create an appointment since $field is not a valid type`,
      async (params) => {
        const appointmentParams: RequestAppointmentParams = generateRequestAppointmentParams(
          params.input,
        );

        await handler.mutations.requestAppointment({
          appointmentParams,
          ...params.error,
        });
      },
    );

    it('should fail since notBefore date is in the past', async () => {
      const notBefore = new Date();
      notBefore.setMinutes(notBefore.getMinutes() - 1);

      await handler.mutations.requestAppointment({
        appointmentParams: generateRequestAppointmentParams({ notBefore }),
        invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDateInThePast)],
      });
    });
  });

  describe('schedule', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'userId'}   | ${`Field "userId" of required type "String!" was not provided.`}
      ${'method'}   | ${`Field "method" of required type "AppointmentMethod!" was not provided.`}
      ${'start'}    | ${`Field "start" of required type "DateTime!" was not provided.`}
      ${'end'}      | ${`Field "end" of required type "DateTime!" was not provided.`}
    `(
      `graphql: should fail to create an appointment since mandatory field $field is missing`,
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        delete appointmentParams[params.field];

        await handler.mutations.scheduleAppointment({
          appointmentParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each(['memberId', 'userId', 'method', 'start', 'end'])(
      'rest: should fail to create an appointment since mandatory field %p is missing',
      async (param) => {
        const appointmentParams = generateScheduleAppointmentParams();
        delete appointmentParams[param];

        await request(server).post(urls.scheduleAppointments).send(appointmentParams).expect(400);
      },
    );

    /* eslint-disable max-len */
    test.each`
      field         | input                      | error
      ${'memberId'} | ${{ memberId: 123 }}       | ${{ missingFieldError: stringError }}
      ${'userId'}   | ${{ userId: 123 }}         | ${{ missingFieldError: stringError }}
      ${'id'}       | ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
      ${'method'}   | ${{ method: 'not-valid' }} | ${{ missingFieldError: 'Enum "AppointmentMethod" cannot represent non-string value' }}
      ${'start'}    | ${{ start: 'not-valid' }}  | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentStartDate)] }}
      ${'end'}      | ${{ end: 'not-valid' }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndDate)] }}
    `(
      /* eslint-enable max-len */
      `graphql: should fail to schedule an appointment since $field is not a valid type`,
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        appointmentParams[params.field] = params.input;

        await handler.mutations.scheduleAppointment({
          appointmentParams,
          ...params.error,
        });
      },
    );

    test.each`
      field         | input
      ${'memberId'} | ${{ memberId: 123 }}
      ${'userId'}   | ${{ userId: 123 }}
      ${'id'}       | ${{ id: 123 }}
      ${'start'}    | ${{ start: 'not-valid' }}
      ${'end'}      | ${{ end: 'not-valid' }}
    `(
      /* eslint-enable max-len */
      `rest: should fail to schedule an appointment since $field is not a valid type`,
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        appointmentParams[params.field] = params.input;

        await request(server).post(urls.scheduleAppointments).send(appointmentParams).expect(400);
      },
    );

    it('should validate that an error is thrown if end date is before start date', async () => {
      const end = faker.date.soon(3);
      const start = new Date(end);
      start.setMinutes(start.getMinutes() + 1);
      const appointmentParams = generateScheduleAppointmentParams({
        start,
        end,
      });

      await handler.mutations.scheduleAppointment({
        appointmentParams,
        invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndAfterStart)],
      });
    });
  });

  describe('end', () => {
    test.each`
      field   | error
      ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
    `(
      `should fail to create an appointment since mandatory field $field is missing`,
      async (params) => {
        const endAppointmentParams = generateEndAppointmentParams();
        delete endAppointmentParams[params.field];

        await handler.mutations.endAppointment({
          endAppointmentParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field             | input                      | error
      ${'id'}           | ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
      ${'noShow'}       | ${{ noShow: 'not-valid' }} | ${{ missingFieldError: 'Boolean cannot represent a non boolean value' }}
      ${'noShowReason'} | ${{ noShowReason: 123 }}   | ${{ missingFieldError: stringError }}
    `(
      /* eslint-enable max-len */
      `should fail to update an appointment no show since $field is not a valid type`,
      async (params) => {
        const endAppointmentParams = generateEndAppointmentParams();
        endAppointmentParams[params.field] = params.input;

        await handler.mutations.endAppointment({
          endAppointmentParams,
          ...params.error,
        });
      },
    );

    it('should fail to end an appointment with noShow=false and noShowReason != null', async () => {
      const endAppointmentParams = {
        id: generateId(),
        noShow: false,
        noShowReason: faker.lorem.sentence(),
      };

      await handler.mutations.endAppointment({
        endAppointmentParams,
        invalidFieldsErrors: [Errors.get(ErrorType.appointmentNoShow)],
      });
    });

    test.each`
      field                 | input                                     | error
      ${'recap'}            | ${{ recap: 123 }}                         | ${stringError}
      ${'strengths'}        | ${{ strengths: 123 }}                     | ${stringError}
      ${'userActionItem'}   | ${{ userActionItem: 123 }}                | ${stringError}
      ${'memberActionItem'} | ${{ memberActionItem: 123 }}              | ${stringError}
      ${'adherence'}        | ${{ scores: { adherence: 'not-valid' } }} | ${floatError}
      ${'adherenceText'}    | ${{ scores: { adherenceText: 123 } }}     | ${stringError}
      ${'wellbeing'}        | ${{ scores: { wellbeing: 'not-valid' } }} | ${floatError}
      ${'wellbeingText'}    | ${{ scores: { wellbeingText: 123 } }}     | ${stringError}
    `(
      /* eslint-enable max-len */
      `should fail to set notes to an appointment since $field is not a valid type`,
      async (params) => {
        const endAppointmentParams: EndAppointmentParams = generateEndAppointmentParams({
          notes: params.input,
        });

        await handler.mutations.endAppointment({
          endAppointmentParams,
          missingFieldError: params.error,
        });
      },
    );
  });

  describe('updateNotes', () => {
    test.each`
      field                 | input                                     | error
      ${'recap'}            | ${{ recap: 123 }}                         | ${stringError}
      ${'strengths'}        | ${{ strengths: 123 }}                     | ${stringError}
      ${'userActionItem'}   | ${{ userActionItem: 123 }}                | ${stringError}
      ${'memberActionItem'} | ${{ memberActionItem: 123 }}              | ${stringError}
      ${'adherence'}        | ${{ scores: { adherence: 'not-valid' } }} | ${floatError}
      ${'adherenceText'}    | ${{ scores: { adherenceText: 123 } }}     | ${stringError}
      ${'wellbeing'}        | ${{ scores: { wellbeing: 'not-valid' } }} | ${floatError}
      ${'wellbeingText'}    | ${{ scores: { wellbeingText: 123 } }}     | ${stringError}
    `(
      `should fail to update notes of an appointment since $field is not a valid type`,
      async (params) => {
        const updateNotesParams = generateUpdateNotesParams({ notes: params.input });

        await handler.mutations.updateNotes({
          updateNotesParams,
          missingFieldError: params.error,
        });
      },
    );
  });
});
