import { BEFORE_ALL_TIMEOUT } from '..';
import { ChangeType, ErrorType, Errors } from '../../src/common';
import {
  AdmissionCategory,
  ChangeMemberDnaParams,
  DietaryCategory,
  DietaryName,
} from '../../src/journey';
import { AdmissionHelper, AppointmentsIntegrationActions, Creators, Handler } from '../aux';
import { lorem } from 'faker';
import { generateId } from '@argus/pandora';

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
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('changeMemberDna', () => {
    test.each([{}, { id: generateId() }])(
      'should fail as only %p is provided',
      async (changeMemberDnaParams) => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        await handler.mutations.changeMemberDna({
          changeMemberDnaParams: { ...changeMemberDnaParams, memberId: member.id },
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
      admissionCategory                       | input                              | error
      ${AdmissionCategory.diagnoses}          | ${{ code: 123 }}                   | ${{ missingFieldError: stringError }}
      ${AdmissionCategory.diagnoses}          | ${{ description: 123 }}            | ${{ missingFieldError: stringError }}
      ${AdmissionCategory.diagnoses}          | ${{ primaryType: 'not-valid' }}    | ${{ missingFieldError: 'does not exist in "PrimaryDiagnosisType" enum' }}
      ${AdmissionCategory.diagnoses}          | ${{ secondaryType: 'not-valid' }}  | ${{ missingFieldError: 'does not exist in "SecondaryDiagnosisType" enum' }}
      ${AdmissionCategory.diagnoses}          | ${{ clinicalStatus: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "ClinicalStatus" enum' }}
      ${AdmissionCategory.diagnoses}          | ${{ severity: 'not-valid' }}       | ${{ missingFieldError: 'does not exist in "DiagnosisSeverity" enum' }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetStart: lorem.word() }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetStart)] }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetStart: '2021-13-1' }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetStart)] }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetStart: new Date() }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetStart)] }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetEnd: lorem.word() }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetEnd)] }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetEnd: '2021-13-1' }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetEnd)] }}
      ${AdmissionCategory.diagnoses}          | ${{ onsetEnd: new Date() }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDiagnosisOnsetEnd)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ startDate: lorem.word() }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedStartDate)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ startDate: '2021-13-1' }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedStartDate)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ startDate: new Date() }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedStartDate)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ endDate: lorem.word() }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedEndDate)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ endDate: '2021-13-1' }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedEndDate)] }}
      ${AdmissionCategory.treatmentRendereds} | ${{ endDate: new Date() }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionTreatmentRenderedEndDate)] }}
      ${AdmissionCategory.dietaries}          | ${{ date: lorem.word() }}          | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDietaryDate)] }}
      ${AdmissionCategory.dietaries}          | ${{ date: '2021-13-1' }}           | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDietaryDate)] }}
      ${AdmissionCategory.dietaries}          | ${{ date: new Date() }}            | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDietaryDate)] }}
      ${AdmissionCategory.medications}        | ${{ startDate: lorem.word() }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationStartDate)] }}
      ${AdmissionCategory.medications}        | ${{ startDate: '2021-13-1' }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationStartDate)] }}
      ${AdmissionCategory.medications}        | ${{ startDate: new Date() }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationStartDate)] }}
      ${AdmissionCategory.medications}        | ${{ endDate: lorem.word() }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationEndDate)] }}
      ${AdmissionCategory.medications}        | ${{ endDate: '2021-13-1' }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationEndDate)] }}
      ${AdmissionCategory.medications}        | ${{ endDate: new Date() }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionMedicationEndDate)] }}
    `(
      `should fail to change ${AdmissionCategory.diagnoses} dna since $input is not valid`,
      async ({ admissionCategory, input, error }) => {
        /* eslint-enable max-len */
        const { member } = await creators.createMemberUserAndOptionalOrg();
        const { field, method } = admissionHelper.mapper.get(admissionCategory);
        const changeMemberDnaParams: ChangeMemberDnaParams = {
          memberId: member.id,
          [`${field}`]: method({ changeType: ChangeType.create, ...input }),
        };
        await handler.mutations.changeMemberDna({ changeMemberDnaParams, ...error });
      },
    );

    test.each(Object.values(AdmissionCategory))(
      `should not fail to ${ChangeType.create} %p on missing optional keys`,
      async (admissionCategory) => {
        const { member } = await creators.createMemberUserAndOptionalOrg();
        const { field, method } = admissionHelper.mapper.get(admissionCategory);
        const data = method({ changeType: ChangeType.create });
        const names = Object.getOwnPropertyNames(data).filter((name) => name !== 'changeType');

        await Promise.all(
          names.map(async (name) => {
            const newData = { ...data };
            delete newData[name];
            const changeMemberDnaParams: ChangeMemberDnaParams = {
              memberId: member.id,
              [`${field}`]: newData,
            };
            await handler.mutations.changeMemberDna({
              changeMemberDnaParams,
            });
          }),
        );
      },
    );
  });

  /* eslint-disable max-len */
  test.each`
    input                               | errors
    ${{ admitDate: lorem.word() }}      | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionAdmitDate)] }}
    ${{ admitDate: '2021-13-1' }}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionAdmitDate)] }}
    ${{ admitDate: new Date() }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionAdmitDate)] }}
    ${{ admitType: lorem.word() }}      | ${{ missingFieldError: 'does not exist in "AdmitType" enum' }}
    ${{ admitSource: lorem.word() }}    | ${{ missingFieldError: 'does not exist in "AdmitSource" enum' }}
    ${{ dischargeDate: lorem.word() }}  | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDischargeDate)] }}
    ${{ dischargeDate: '2021-13-1' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDischargeDate)] }}
    ${{ dischargeDate: new Date() }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.admissionDischargeDate)] }}
    ${{ dischargeTo: lorem.word() }}    | ${{ missingFieldError: 'does not exist in "DischargeTo" enum' }}
    ${{ facility: 123 }}                | ${{ missingFieldError: stringError }}
    ${{ specialInstructions: 123 }}     | ${{ missingFieldError: stringError }}
    ${{ reasonForAdmission: 123 }}      | ${{ missingFieldError: stringError }}
    ${{ hospitalCourse: 123 }}          | ${{ missingFieldError: stringError }}
    ${{ admissionSummary: 123 }}        | ${{ missingFieldError: stringError }}
    ${{ warningSigns: [lorem.word()] }} | ${{ missingFieldError: 'does not exist in "WarningSigns" enum' }}
    ${{ warningSigns: lorem.word() }}   | ${{ missingFieldError: 'does not exist in "WarningSigns" enum' }}
    ${{ activity: lorem.word() }}       | ${{ missingFieldError: 'Expected type "ActivityInput" to be an object.' }}
    ${{ woundCare: lorem.word() }}      | ${{ missingFieldError: 'Expected type "WoundCareInput" to be an object.' }}
  `(`should fail to change dna since $input is not valid`, async ({ input, errors }) => {
    /* eslint-enable max-len */
    const changeMemberDnaParams: ChangeMemberDnaParams = { ...input, memberId: generateId() };
    await handler.mutations.changeMemberDna({ changeMemberDnaParams, ...errors });
  });

  it('should throw error when dietary category and name mismatch', async () => {
    const { member } = await creators.createMemberUserAndOptionalOrg();
    const { field, method } = admissionHelper.mapper.get(AdmissionCategory.diagnoses);
    const changeMemberDnaParams: ChangeMemberDnaParams = {
      memberId: member.id,
      [`${field}`]: method({
        changeType: ChangeType.create,
        category: DietaryCategory.fiber,
        name: DietaryName.cantonese,
      }),
    };
    await handler.mutations.changeMemberDna({
      changeMemberDnaParams,
      invalidFieldsErrors: [Errors.get(ErrorType.admissionDietaryCategoryNameMismatch)],
    });
  });
});
