import { BEFORE_ALL_TIMEOUT, generateId } from '..';
import { ChangeType, ErrorType, Errors } from '../../src/common';
import { AdmissionCategory, ChangeMemberDnaParams } from '../../src/member';
import { AdmissionHelper, AppointmentsIntegrationActions, Creators } from '../aux';
import { Handler } from '../aux/handler';

const stringError = `String cannot represent a non string value`;

describe('Validations - DNA', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  const admissionHelper: AdmissionHelper = new AdmissionHelper();

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

  describe('changeMemberDna', () => {
    test.each([{ memberId: generateId() }, { memberId: generateId(), id: generateId() }])(
      'should fail as only %p is provided',
      async (changeMemberDnaParams) => {
        await handler.mutations.changeMemberDna({
          changeMemberDnaParams,
          invalidFieldsErrors: [Errors.get(ErrorType.admissionDataNotProvidedOnChangeDna)],
        });
      },
    );

    Object.values(AdmissionCategory).forEach((admissionCategory: AdmissionCategory) => {
      test.each`
        changeType           | id
        ${ChangeType.create} | ${generateId()}
        ${ChangeType.update} | ${undefined}
        ${ChangeType.delete} | ${undefined}
      `(
        `should fail to $changeType ${admissionCategory} since id($id) missmatch`,
        async ({ changeType, id }) => {
          const { field, method } = admissionHelper.mapper.get(admissionCategory);
          const changeMemberDnaParams: ChangeMemberDnaParams = {
            memberId: generateId(),
            [`${field}`]: method({ changeType, id }),
          };
          await handler.mutations.changeMemberDna({
            changeMemberDnaParams,
            invalidFieldsErrors: [Errors.get(ErrorType.admissionIdAndChangeTypeAligned)],
          });
        },
      );
    });

    /* eslint-disable max-len */
    test.each`
      admissionCategory              | input                              | error
      ${AdmissionCategory.diagnoses} | ${{ code: 123 }}                   | ${stringError}
      ${AdmissionCategory.diagnoses} | ${{ description: 123 }}            | ${stringError}
      ${AdmissionCategory.diagnoses} | ${{ primaryType: 'not-valid' }}    | ${'does not exist in "PrimaryDiagnosisType" enum'}
      ${AdmissionCategory.diagnoses} | ${{ secondaryType: 'not-valid' }}  | ${'does not exist in "SecondaryDiagnosisType" enum'}
      ${AdmissionCategory.diagnoses} | ${{ clinicalStatus: 'not-valid' }} | ${'does not exist in "ClinicalStatus" enum'}
      ${AdmissionCategory.diagnoses} | ${{ severity: 'not-valid' }}       | ${'does not exist in "DiagnosisSeverity" enum'}
    `(
      `should fail to change dna since $input is not valid`,
      async ({ admissionCategory, input, error }) => {
        /* eslint-enable max-len */
        const { field, method } = admissionHelper.mapper.get(admissionCategory);
        const changeMemberDnaParams: ChangeMemberDnaParams = {
          memberId: generateId(),
          [`${field}`]: method({ changeType: ChangeType.create, ...input }),
        };
        await handler.mutations.changeMemberDna({
          changeMemberDnaParams,
          missingFieldError: error,
        });
      },
    );
  });
});
