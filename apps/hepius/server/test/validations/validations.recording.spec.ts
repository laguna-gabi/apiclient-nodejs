import { generateId } from '@argus/pandora';
import { BEFORE_ALL_TIMEOUT, generateUpdateRecordingParams } from '..';
import { ErrorType, Errors } from '../../src/common';
import { AppointmentsIntegrationActions, Creators } from '../aux';
import { Handler } from '../aux/handler';

const stringError = `String cannot represent a non string value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    await creators.createAndValidateUser();
  }, BEFORE_ALL_TIMEOUT);

  afterAll(async () => {
    await handler.afterAll();
  });

  const checkNoneExistingMemberAndWrongMemberID = <T>(
    title: string,
    getFunction: () => (props: T) => Promise<unknown>,
    getMainInput: (memberId: string) => T,
  ) => {
    describe(title, () => {
      it('should throw error on non existing member', async () => {
        const fn = getFunction();
        await fn({
          ...getMainInput(generateId()),
          invalidFieldsErrors: [Errors.get(ErrorType.memberNotFound)],
        });
      });

      it('should throw error on invalid member id', async () => {
        const fn = getFunction();
        await fn({
          ...getMainInput('123'),
          invalidFieldsErrors: [Errors.get(ErrorType.memberIdInvalid)],
        });
      });
    });
  };

  describe('getRecordings', () => {
    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberIdInvalid)}
      ${123}   | ${stringError}
    `(`should fail to get recordings by member id - value $field is invalid`, async (params) => {
      await handler.queries.getRecordings({
        memberId: params.field,
        invalidFieldsError: params.error,
      });
    });
  });

  checkNoneExistingMemberAndWrongMemberID(
    'getMemberUploadRecordingLink',
    () => handler.queries.getMemberUploadRecordingLink,
    (memberId) => ({ recordingLinkParams: { memberId, id: generateId() } }),
  );

  checkNoneExistingMemberAndWrongMemberID(
    'getMemberMultipartUploadRecordingLink',
    () => handler.queries.getMemberMultipartUploadRecordingLink,
    (memberId) => ({
      multipartUploadRecordingLinkParams: {
        memberId,
        id: generateId(),
        uploadId: generateId(),
        partNumber: 0,
      },
    }),
  );

  checkNoneExistingMemberAndWrongMemberID(
    'getMemberDownloadRecordingLink',
    () => handler.queries.getMemberDownloadRecordingLink,
    (memberId) => ({ recordingLinkParams: { memberId, id: generateId() } }),
  );

  checkNoneExistingMemberAndWrongMemberID(
    'completeMultipartUpload',
    () => handler.mutations.completeMultipartUpload,
    (memberId) => ({
      completeMultipartUploadParams: {
        memberId,
        id: generateId(),
        uploadId: generateId(),
      },
    }),
  );

  describe('updateRecording', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
    `(`should fail to update recording since mandatory field $field is missing`, async (params) => {
      const updateRecordingParams = generateUpdateRecordingParams();
      delete updateRecordingParams[params.field];
      await handler.mutations.updateRecording({
        updateRecordingParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                            | error
      ${{ id: 123 }}                   | ${stringError}
      ${{ memberId: 123 }}             | ${stringError}
      ${{ userId: 123 }}               | ${stringError}
      ${{ answered: 123 }}             | ${'Boolean cannot represent a non boolean value'}
      ${{ phone: 123 }}                | ${stringError}
      ${{ consent: 123 }}              | ${'Boolean cannot represent a non boolean value'}
      ${{ identityVerification: 123 }} | ${'Boolean cannot represent a non boolean value'}
    `(`should fail to update recording since $input is not a valid type`, async (params) => {
      const updateRecordingParams = generateUpdateRecordingParams({ ...params.input });
      await handler.mutations.updateRecording({
        updateRecordingParams,
        missingFieldError: params.error,
      });
    });
  });
});
