import {
  generateId,
  generateNoShowAppointmentParams,
  generateNotesParams,
  generateRequestAppointmentParams,
  generateScheduleAppointmentParams,
} from '../index';
import * as faker from 'faker';
import { RequestAppointmentParams, SetNotesParams } from '../../src/appointment';
import { Errors, ErrorType } from '../../src/common';
import { Handler } from './aux/handler';

const stringError = `String cannot represent a non string value`;

describe('Validations - appointment', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
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
    /* eslint-disable max-len */
    test.each`
      field          | error
      ${'memberId'}  | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'userId'}    | ${`Field "userId" of required type "String!" was not provided.`}
      ${'notBefore'} | ${`Field "notBefore" of required type "DateTime!" was not provided.`}
      ${'method'}    | ${`Field "method" of required type "AppointmentMethod!" was not provided.`}
      ${'start'}     | ${`Field "start" of required type "DateTime!" was not provided.`}
      ${'end'}       | ${`Field "end" of required type "DateTime!" was not provided.`}
    `(
      /* eslint-enable max-len */
      `should fail to create an appointment since mandatory field $field is missing`,
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        delete appointmentParams[params.field];

        await handler.mutations.scheduleAppointment({
          appointmentParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field          | input                         | error
      ${'memberId'}  | ${{ memberId: 123 }}          | ${{ missingFieldError: stringError }}
      ${'userId'}    | ${{ userId: 123 }}            | ${{ missingFieldError: stringError }}
      ${'notBefore'} | ${{ notBefore: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentNotBeforeDate)] }}
      ${'method'}    | ${{ method: 'not-valid' }}    | ${{ missingFieldError: 'Enum "AppointmentMethod" cannot represent non-string value' }}
      ${'start'}     | ${{ start: 'not-valid' }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentStartDate)] }}
      ${'end'}       | ${{ end: 'not-valid' }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.appointmentEndDate)] }}
    `(
      /* eslint-enable max-len */
      `should fail to schedule an appointment since $field is not a valid type`,
      async (params) => {
        const appointmentParams = generateScheduleAppointmentParams();
        appointmentParams[params.field] = params.input;

        await handler.mutations.scheduleAppointment({
          appointmentParams,
          ...params.error,
        });
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

  describe('noShow', () => {
    test.each`
      field   | error
      ${'id'} | ${`Field "id" of required type "String!" was not provided.`}
    `(
      `should fail to create an appointment since mandatory field $field is missing`,
      async (params) => {
        const noShowParams = generateNoShowAppointmentParams();
        delete noShowParams[params.field];

        await handler.mutations.noShowAppointment({
          noShowParams,
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      field       | input                      | error
      ${'id'}     | ${{ id: 123 }}             | ${{ missingFieldError: stringError }}
      ${'noShow'} | ${{ noShow: 'not-valid' }} | ${{ missingFieldError: 'Boolean cannot represent a non boolean value' }}
      ${'reason'} | ${{ reason: 123 }}         | ${{ missingFieldError: stringError }}
    `(
      /* eslint-enable max-len */
      `should fail to update an appointment no show since $field is not a valid type`,
      async (params) => {
        const noShowParams = generateNoShowAppointmentParams();
        noShowParams[params.field] = params.input;

        await handler.mutations.noShowAppointment({
          noShowParams,
          ...params.error,
        });
      },
    );

    const reason = faker.lorem.sentence();
    test.each`
      input
      ${{ noShow: true }}
      ${{ noShow: false, reason }}
    `(
      /* eslint-disable max-len */
      `should fail to update an appointment no show since noShow and reason combinations are not valid for $input`,
      /* eslint-enable max-len */
      async (params) => {
        const noShowParams = {
          id: generateId(),
          ...params.input,
        };

        await handler.mutations.noShowAppointment({
          noShowParams,
          invalidFieldsErrors: [Errors.get(ErrorType.appointmentNoShow)],
        });
      },
    );
  });

  describe('setNotes', () => {
    /* eslint-disable max-len */
    test.each`
      field              | error
      ${'appointmentId'} | ${`Field "appointmentId" of required type "String!" was not provided.`}
    `(
      /* eslint-enable max-len */
      `should fail to set notes to an appointment since mandatory field $field is missing`,
      async (params) => {
        const noteParams: SetNotesParams = {
          appointmentId: generateId(),
          ...generateNotesParams(),
        };

        delete noteParams[params.field];

        await handler.mutations.setNotes({
          params: noteParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      field          | error
      ${'adherence'} | ${`Field "adherence" of required type "Float!" was not provided.`}
      ${'wellbeing'} | ${`Field "wellbeing" of required type "Float!" was not provided.`}
    `(
      `should fail to set notes to an appointment since mandatory field $field is missing`,
      async (params) => {
        const noteParams: SetNotesParams = {
          appointmentId: generateId(),
          ...generateNotesParams(),
        };

        delete noteParams.scores[params.field];

        await handler.mutations.setNotes({
          params: noteParams,
          missingFieldError: params.error,
        });
      },
    );
  });
});
