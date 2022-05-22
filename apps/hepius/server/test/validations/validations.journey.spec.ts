import { BEFORE_ALL_TIMEOUT, generateSetGeneralNotesParams, generateUpdateJourneyParams } from '..';
import { AppointmentsIntegrationActions, Creators } from '../aux';
import { Handler } from '../aux/handler';
import { UpdateJourneyParams } from '../../src/journey';
import { ErrorType, Errors } from '../../src/common';
import { generateId } from '@argus/pandora';
const stringError = `String cannot represent a non string value`;

describe('Validations - Journey', () => {
  const handler: Handler = new Handler();
  let creators: Creators;

  beforeAll(async () => {
    await handler.beforeAll();
    const appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    await creators.createAndValidateUser();
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
      ${{ id: 123 }}                      | ${stringError}
      ${{ memberId: 123 }}                | ${stringError}
      ${{ fellowName: 123 }}              | ${stringError}
      ${{ healthPlan: 123 }}              | ${stringError}
      ${{ readmissionRisk: 'not-valid' }} | ${'does not exist in "ReadmissionRisk" enum'}
    `(`should fail to update a member since setting $input is not a valid`, async (params) => {
      const updateJourneyParams = generateUpdateJourneyParams({ ...params.input });
      await handler.mutations.updateJourney({
        updateJourneyParams,
        missingFieldError: params.error,
      });
    });
  });

  describe('getJourneys + getJourney + getActiveJourney', () => {
    it('should fail to get journeys since member is invalid', async () => {
      await handler.queries.getJourneys({
        memberId: 'not-valid',
        invalidFieldsError: Errors.get(ErrorType.memberIdInvalid),
      });
    });

    it('should fail to get active journey since member is invalid', async () => {
      await handler.queries.getActiveJourney({
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
      ${{ nurseNotes: 123 }}
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

    it(`should fail to set notes since $input does not contain notes or nurseNotes`, async () => {
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams: { memberId: generateId() },
        invalidFieldsErrors: [Errors.get(ErrorType.memberNotesAndNurseNotesNotProvided)],
      });
    });

    test.each([
      { note: undefined, nurseNotes: undefined },
      { note: undefined, nurseNotes: null },
      { note: null, nurseNotes: undefined },
      { note: null, nurseNotes: null },
      { note: undefined },
      { note: null },
      { nurseNotes: undefined },
      { nurseNotes: null },
      {},
    ])('should fail to set notes since %p does not contain notes or nurseNotes', async (input) => {
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams: { memberId: generateId(), ...input },
        invalidFieldsErrors: [Errors.get(ErrorType.memberNotesAndNurseNotesNotProvided)],
      });
    });
  });
});
