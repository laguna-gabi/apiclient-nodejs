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
const floatError = `Float cannot represent non numeric value`;

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
      field                 | scores   | error
      ${'appointmentId'}    | ${false} | ${`Field "appointmentId" of required type "String!" was not provided.`}
      ${'recap'}            | ${false} | ${`Field "recap" of required type "String!" was not provided.`}
      ${'strengths'}        | ${false} | ${`Field "strengths" of required type "String!" was not provided.`}
      ${'userActionItem'}   | ${false} | ${`Field "userActionItem" of required type "String!" was not provided.`}
      ${'memberActionItem'} | ${false} | ${`Field "memberActionItem" of required type "String!" was not provided.`}
      ${'wellbeing'}        | ${true}  | ${`Field "wellbeing" of required type "Float!" was not provided.`}
      ${'adherence'}        | ${true}  | ${`Field "adherence" of required type "Float!" was not provided.`}
    `(
      /* eslint-enable max-len */
      `should fail to set notes to an appointment since mandatory field $field is missing`,
      async (params) => {
        const noteParams: SetNotesParams = {
          appointmentId: generateId(),
          ...generateNotesParams(),
        };

        params.scores ? delete noteParams.scores[params.field] : delete noteParams[params.field];

        await handler.mutations.setNotes({
          params: noteParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      input                 | input                         | error
      ${'recap'}            | ${{ recap: 123 }}             | ${stringError}
      ${'strengths'}        | ${{ strengths: 123 }}         | ${stringError}
      ${'userActionItem'}   | ${{ userActionItem: 123 }}    | ${stringError}
      ${'memberActionItem'} | ${{ memberActionItem: 123 }}  | ${stringError}
      ${'adherence'}        | ${{ adherence: 'not-valid' }} | ${floatError}
      ${'adherenceText'}    | ${{ adherenceText: 123 }}     | ${stringError}
      ${'wellbeing'}        | ${{ wellbeing: 'not-valid' }} | ${floatError}
      ${'wellbeingText'}    | ${{ wellbeingText: 123 }}     | ${stringError}
    `(
      /* eslint-enable max-len */
      `should fail to set notes to an appointment since $field is not a valid type`,
      async (params) => {
        const noteParams: SetNotesParams = {
          appointmentId: generateId(),
          ...generateNotesParams({ ...params.input }),
        };

        await handler.mutations.setNotes({
          params: noteParams,
          missingFieldError: params.error,
        });
      },
    );
  });
});
