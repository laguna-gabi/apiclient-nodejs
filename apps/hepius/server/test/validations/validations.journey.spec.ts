import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateRequestHeaders,
  generateSetGeneralNotesParams,
  generateUpdateJourneyParams,
  stringError,
} from '..';
import { Handler } from '../aux/handler';
import { AddCaregiverParams, UpdateJourneyParams } from '../../src/journey';
import { ErrorType, Errors } from '../../src/common';
import { generateId } from '@argus/pandora';

describe('Validations - Journey', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('updateJourney', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
    `(`should fail to update a journey since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const updateJourneyParams: UpdateJourneyParams = generateUpdateJourneyParams();
      delete updateJourneyParams[params.field];
      await handler.mutations.updateJourney({
        updateJourneyParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                               | error
      ${{ memberId: 123 }}                | ${stringError}
      ${{ readmissionRisk: 'not-valid' }} | ${'does not exist in "ReadmissionRisk" enum'}
    `(`should fail to update a member since setting $input is not a valid`, async (params) => {
      const updateJourneyParams = generateUpdateJourneyParams({ ...params.input });
      await handler.mutations.updateJourney({
        updateJourneyParams,
        missingFieldError: params.error,
      });
    });
  });

  describe('getJourneys + getJourney + getRecentJourney', () => {
    it('should fail to get journeys since member is invalid', async () => {
      await handler.queries.getJourneys({
        memberId: 'not-valid',
        invalidFieldsError: Errors.get(ErrorType.memberIdInvalid),
      });
    });

    it('should fail to get recent journey since member is invalid', async () => {
      await handler.queries.getRecentJourney({
        memberId: 'not-valid',
        invalidFieldsError: Errors.get(ErrorType.memberIdInvalid),
      });
    });

    it('should fail to get a journey since id is invalid', async () => {
      await handler.queries.getJourney({
        id: 'not-valid',
        invalidFieldsError: Errors.get(ErrorType.journeyIdInvalid),
      });
    });
  });

  describe('setGeneralNotes', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
    `(
      `should fail to set general notes since mandatory field $field is missing`,
      async (params) => {
        const setGeneralNotesParams = generateSetGeneralNotesParams();
        delete setGeneralNotesParams[params.field];
        await handler.mutations.setGeneralNotes({
          setGeneralNotesParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      field
      ${{ memberId: 123 }}
      ${{ note: 123 }}
    `(`should fail to set notes since $input is not a valid type`, async (params) => {
      const setGeneralNotesParams = generateSetGeneralNotesParams({ ...params.field });
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams,
        missingFieldError: stringError,
      });
    });

    it(`should fail to set notes since memberId is not a valid type`, async () => {
      const setGeneralNotesParams = generateSetGeneralNotesParams({ memberId: '123' });
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberIdInvalid)],
      });
    });
  });

  describe('caregiver', () => {
    describe('addCaregiver - invalid and missing fields', () => {
      /* eslint-disable max-len */
      test.each`
        field             | error
        ${'firstName'}    | ${`Field "firstName" of required type "String!" was not provided.`}
        ${'lastName'}     | ${`Field "lastName" of required type "String!" was not provided.`}
        ${'relationship'} | ${`Field "relationship" of required type "Relationship!" was not provided.`}
        ${'phone'}        | ${`Field "phone" of required type "String!" was not provided.`}
      `(`should fail to add a caregiver if $field is missing`, async (params) => {
        const addCaregiverParams = generateAddCaregiverParams();
        delete addCaregiverParams[params.field];
        await handler.mutations.addCaregiver({
          addCaregiverParams,
          missingFieldError: params.error,
        });
      });

      test.each`
        input                                                                      | error
        ${{ email: 'invalid' }}                                                    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverEmailInvalid)] }}
        ${{ phone: 'invalid' }}                                                    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverPhoneInvalid)] }}
        ${{ firstName: 'a' }}                                                      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverMinMaxLength)] }}
        ${{ lastName: 'a' }}                                                       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverMinMaxLength)] }}
        ${{ lastName: 'nameistoolong-nameistoolong-nameistoolong-nameistoolong' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverMinMaxLength)] }}
      `(
        /* eslint-enable max-len */
        `should fail to add a caregiver due to invalid $input field`,
        async (params) => {
          const addCaregiverParams: AddCaregiverParams = generateAddCaregiverParams({
            memberId: generateId(),
            ...params.input,
          });
          await handler.mutations.addCaregiver({
            addCaregiverParams,
            ...params.error,
          });
        },
      );
    });

    describe('deleteCaregiver', () => {
      test.each`
        input    | error
        ${'123'} | ${[Errors.get(ErrorType.caregiverIdInvalid)]}
      `(`should fail to delete caregiver by id $input is not a valid type`, async (params) => {
        await handler.mutations.deleteCaregiver({
          id: params.input,
          invalidFieldsErrors: [params.error],
          requestHeaders: handler.defaultUserRequestHeaders,
        });
      });
    });

    describe('getCaregivers', () => {
      test.each`
        input  | error
        ${123} | ${stringError}
      `(`should fail to get caregivers by member id $input is not a valid type`, async (params) => {
        await handler.queries.getCaregivers({
          memberId: params.input,
          invalidFieldsError: params.error,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        });
      });
    });
  });
});
