import {
  checkAuditValues,
  generateAddCaregiverParams,
  generateRequestHeaders,
  generateUpdateCaregiverParams,
} from '../index';
import { Handler } from '../aux';
import { CaregiverDocument } from '../../src/member';

describe('Integration tests : Audit', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('Caregiver', () => {
    it('should update createdAt and updatedAt fields', async () => {
      // Add Caregiver for PatientZero and by PatientZero:
      const addCaregiverParams = generateAddCaregiverParams({
        memberId: handler.patientZero.id.toString(),
      });

      const { id } = await handler.mutations.addCaregiver({
        addCaregiverParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (of PatientZero)
      expect(
        await checkAuditValues<CaregiverDocument>(
          id,
          handler.caregiverModel,
          handler.patientZero.id.toString(),
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();

      // Update Caregiver for PatientZero and by PatientZero's primary user:
      const updateCaregiverParams = generateUpdateCaregiverParams({
        id,
        memberId: handler.patientZero.id.toString(),
      });

      // Get primary user authId and id for token in request header and validation
      const { id: userId, authId: userAuthId } = await handler.userService.get(
        handler.patientZero.primaryUserId.toString(),
      );

      await handler.mutations.updateCaregiver({
        updateCaregiverParams,
        requestHeaders: generateRequestHeaders(userAuthId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<CaregiverDocument>(
          id,
          handler.caregiverModel,
          handler.patientZero.id.toString(),
          userId,
        ),
      ).toBeTruthy();
    });
  });
});
