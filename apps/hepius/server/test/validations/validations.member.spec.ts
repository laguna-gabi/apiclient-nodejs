import { ExternalKey } from '@argus/irisClient';
import {
  CancelNotificationType,
  NotificationType,
  Platform,
  generateId,
  generateZipCode,
} from '@argus/pandora';
import { addDays, subSeconds } from 'date-fns';
import { date, internet, lorem } from 'faker';
import * as request from 'supertest';
import { v4 } from 'uuid';
import {
  BEFORE_ALL_TIMEOUT,
  generateAddCaregiverParams,
  generateCancelNotifyParams,
  generateCreateActionItemParams,
  generateCreateMemberParams,
  generateDateOnly,
  generateDeleteDischargeDocumentParams,
  generateDeleteMemberParams,
  generateGetMemberUploadJournalAudioLinkParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateNotifyContentParams,
  generateNotifyParams,
  generateOrgParams,
  generateRandomHeight,
  generateRandomName,
  generateReplaceMemberOrgParams,
  generateReplaceUserForMemberParams,
  generateRequestHeaders,
  generateUniqueUrl,
  generateUpdateActionItemParams,
  generateUpdateJournalTextParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  urls,
} from '..';
import { ErrorType, Errors, maxLength, minLength } from '../../src/common';
import {
  AddCaregiverParams,
  CancelNotifyParams,
  CreateMemberParams,
  Honorific,
  MaritalStatus,
  NotifyParams,
  Sex,
  UpdateMemberParams,
  defaultMemberParams,
} from '../../src/member';
import { AppointmentsIntegrationActions, Creators } from '../aux';
import { Handler } from '../aux/handler';
import { graphql } from 'config';

const stringError = `String cannot represent a non string value`;
const BooleanError = `Boolean cannot represent a non boolean value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();
  let creators: Creators;
  let appointmentsActions: AppointmentsIntegrationActions;
  let server;

  beforeAll(async () => {
    await handler.beforeAll();
    appointmentsActions = new AppointmentsIntegrationActions(
      handler.mutations,
      handler.defaultUserRequestHeaders,
    );
    creators = new Creators(handler, appointmentsActions);
    server = handler.app.getHttpServer();
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

  describe('createMember + getMember', () => {
    /* eslint-disable max-len */
    test.each`
      field            | error
      ${'phone'}       | ${`Field "phone" of required type "String!" was not provided.`}
      ${'firstName'}   | ${`Field "firstName" of required type "String!" was not provided.`}
      ${'lastName'}    | ${`Field "lastName" of required type "String!" was not provided.`}
      ${'dateOfBirth'} | ${`Field "dateOfBirth" of required type "String!" was not provided.`}
    `(`should fail to create a member since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId: generateId() });
      delete memberParams[params.field];
      await handler.mutations.createMember({ memberParams, missingFieldError: params.error });
    });

    test.each`
      field              | defaultValue
      ${'sex'}           | ${defaultMemberParams.sex}
      ${'email'}         | ${null}
      ${'dischargeDate'} | ${null}
      ${'honorific'}     | ${defaultMemberParams.honorific}
    `(`should set default value if exists for optional field $field`, async (params) => {
      /* eslint-enable max-len */
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      await creators.createAndValidateUser({ orgId });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      delete memberParams[params.field];

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({
        id,
        requestHeaders: generateRequestHeaders(memberParams.authId),
      });
      expect(member[params.field]).toEqual(params.defaultValue);
    });

    test.each`
      field              | value
      ${'sex'}           | ${Sex.female}
      ${'email'}         | ${internet.email()}
      ${'zipCode'}       | ${generateZipCode()}
      ${'honorific'}     | ${Honorific.dr}
      ${'maritalStatus'} | ${MaritalStatus.widowed}
      ${'height'}        | ${generateRandomHeight()}
    `(`should be able to set value for optional field $field`, async (params) => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      await creators.createAndValidateUser({ orgId });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      memberParams[params.field] = params.value;

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({
        id,
        requestHeaders: generateRequestHeaders(memberParams.authId),
      });
      expect(member[params.field]).toEqual(params.value);
    });

    it('should set value for optional field dischargeDate', async () => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      await creators.createAndValidateUser({ orgId });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });

      memberParams.dischargeDate = generateDateOnly(date.soon(3));

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({
        id,
        requestHeaders: generateRequestHeaders(memberParams.authId),
      });
      expect(generateDateOnly(new Date(member.dischargeDate))).toEqual(memberParams.dischargeDate);
    });

    /* eslint-disable max-len */
    test.each`
      input                             | error
      ${{ phone: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ orgId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ orgId: '123' }}               | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberOrgIdInvalid)] }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ zipCode: '123' }}             | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberInvalidZipCode)] }}
      ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dateOfBirth: '2021-13-1' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dateOfBirth: new Date() }}    | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ dischargeDate: '2021-13-1' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ dischargeDate: new Date() }}  | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ honorific: 'not-valid' }}     | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
      ${{ userId: 'not-valid' }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userIdInvalid)] }}
      ${{ maritalStatus: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "MaritalStatus" enum' }}
      ${{ height: 'not-valid' }}        | ${{ missingFieldError: `Float cannot represent non numeric value` }}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since setting $input is not a valid`,
      async (params) => {
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: generateId(),
          ...params.input,
        });

        await handler.mutations.createMember({ memberParams, ...params.error });
      },
    );

    test.each`
      length           | errorString | field
      ${minLength - 1} | ${'short'}  | ${'firstName'}
      ${maxLength + 1} | ${'long'}   | ${'firstName'}
      ${minLength - 1} | ${'short'}  | ${'lastName'}
      ${maxLength + 1} | ${'long'}   | ${'lastName'}
    `(`should fail to create a member since $field is too $errorString`, async (params) => {
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId: generateId() });
      memberParams[params.field] = generateRandomName(params.length);
      await handler.mutations.createMember({
        memberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberMinMaxLength)],
      });
    });

    test.each`
      height                               | errorString
      ${graphql.validators.height.max + 1} | ${'high'}
      ${graphql.validators.height.min - 1} | ${'low'}
    `(`should fail to create a member since $field is too $errorString`, async (params) => {
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId: generateId() });
      memberParams.height = params.height;
      await handler.mutations.createMember({
        memberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberHeightNotInRange)],
      });
    });

    /* eslint-disable max-len */
    test.each`
      field            | input                            | errors
      ${'phone'}       | ${{ phone: '+410' }}             | ${[Errors.get(ErrorType.memberPhone)]}
      ${'dateOfBirth'} | ${{ dateOfBirth: lorem.word() }} | ${[Errors.get(ErrorType.memberDateOfBirth)]}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since $field is not valid`,
      async (params) => {
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: generateId(),
          ...params.input,
        });
        await handler.mutations.createMember({ memberParams, invalidFieldsErrors: params.errors });
      },
    );

    it('should throw error on non existing member from web', async () => {
      await handler.queries.getMember({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    it('should throw error on non existing member from mobile', async () => {
      await handler.queries.getMember({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    it('rest: should fail to create member if phone already exists', async () => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      await handler.mutations.createMember({ memberParams });
      const newMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        phone: memberParams.phone,
      });
      await request(server).post(urls.members).send(newMemberParams).expect(400);
    });

    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberIdInvalid)}
      ${123}   | ${stringError}
    `(`should fail to get member by id - value $field is invalid`, async (params) => {
      await handler.queries.getMember({
        id: params.field,
        invalidFieldsError: params.error,
      });
    });

    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberOrgIdInvalid)}
      ${123}   | ${stringError}
    `(`should fail to get member by id - value $field is invalid`, async (params) => {
      const { errors } = await handler.queries.getMembers({
        orgId: params.field,
      });

      expect(errors[0].message).toContain(params.error);
    });
  });

  describe('getMembersAppointments', () => {
    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberOrgIdInvalid)}
      ${123}   | ${stringError}
    `(`should fail to get member appointments by id - value $field is invalid`, async (params) => {
      await handler.queries.getMembersAppointments(params.field, params.error);
    });
  });

  describe('getMemberUploadDischargeDocumentsLinks', () => {
    it('should fail to get upload links since mandatory field id is missing', async () => {
      await handler.queries.getMemberUploadDischargeDocumentsLinks({
        missingFieldError: `Variable \"$id\" of required type \"String!\" was not provided.`,
      });
    });

    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberUploadDischargeDocumentsLinks({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.memberIdInvalid)}
      ${123}   | ${stringError}
    `(
      `should fail to get member upload discharge doc by id - value $field is invalid`,
      async (params) => {
        await handler.queries.getMemberUploadDischargeDocumentsLinks({
          id: params.field,
          invalidFieldsError: params.error,
        });
      },
    );
  });

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

  describe('getMemberDownloadDischargeDocumentsLinks', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberDownloadDischargeDocumentsLinks({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('deleteDischargeDocument', () => {
    /* eslint-disable max-len */
    test.each`
      field                      | missing
      ${'memberId'}              | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'dischargeDocumentType'} | ${`Field "dischargeDocumentType" of required type "DischargeDocumentType!" was not provided.`}
    `(`should fail to delete discharge document since $field is missing`, async (params) => {
      const deleteDischargeDocumentParams = generateDeleteDischargeDocumentParams();
      delete deleteDischargeDocumentParams[params.field];
      await handler.mutations.deleteDischargeDocument({
        deleteDischargeDocumentParams,
        missingFieldError: params.missing,
      });
    });

    /* eslint-disable max-len */
    test.each`
      input                             | missing
      ${{ memberId: 123 }}              | ${stringError}
      ${{ dischargeDocumentType: 123 }} | ${'cannot represent non-string value'}
    `(`should fail to delete discharge document since $input is invalid`, async (params) => {
      const deleteDischargeDocumentParams = generateDeleteDischargeDocumentParams({
        ...params.input,
      });
      await handler.mutations.deleteDischargeDocument({
        deleteDischargeDocumentParams,
        missingFieldError: params.missing,
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

  checkNoneExistingMemberAndWrongMemberID(
    'getMemberDownloadRecordingLink',
    () => handler.queries.getMemberDownloadRecordingLink,
    (memberId) => ({ recordingLinkParams: { memberId, id: generateId() } }),
  );

  describe('getMemberConfig', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberConfig({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('registerForNotificationParams', () => {
    test.each([
      {
        token: 'a-b',
        memberId: generateId(),
        error: Errors.get(ErrorType.memberRegisterForNotificationToken),
      },
      {
        token: 'a_b',
        memberId: generateId(),
        error: Errors.get(ErrorType.memberRegisterForNotificationToken),
      },
      {
        token: 'ab',
        memberId: '123',
        error: Errors.get(ErrorType.memberIdInvalid),
      },
    ])('should not be able to register due to invalid fields %p', async (params) => {
      await handler.mutations.registerMemberForNotifications({
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        registerForNotificationParams: {
          platform: Platform.ios,
          token: params.token,
          memberId: params.memberId,
        },
        invalidFieldsErrors: [params.error],
      });
    });
  });

  describe('notify', () => {
    /* eslint-disable max-len */
    test.each`
      input                             | missing
      ${{ userId: 123 }}                | ${stringError}
      ${{ memberId: 123 }}              | ${stringError}
      ${{ metadata: { content: 123 } }} | ${stringError}
      ${{ metadata: { peerId: 123 } }}  | ${stringError}
      ${{ type: 123 }}                  | ${'cannot represent non-string value'}
    `(
      `should fail to notify since setting $input is not a valid (missing indication)`,
      async (params) => {
        const notifyParams: NotifyParams = generateNotifyParams({ ...params.input });
        await handler.mutations.notify({
          notifyParams,
          missingFieldError: params.missing,
        });
      },
    );

    test.each`
      input                  | invalid
      ${{ userId: '123' }}   | ${[Errors.get(ErrorType.userIdInvalid)]}
      ${{ memberId: '123' }} | ${[Errors.get(ErrorType.memberIdInvalid)]}
    `(`should fail to notify since setting $input is not a valid`, async (params) => {
      const notifyParams: NotifyParams = generateNotifyParams({ ...params.input });
      await handler.mutations.notify({
        notifyParams,
        invalidFieldsErrors: params.invalid,
      });
    });

    /* eslint-disable max-len */
    test.each`
      field         | error
      ${'userId'}   | ${`Field "userId" of required type "String!" was not provided.`}
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'type'}     | ${`Field "type" of required type "NotificationType!" was not provided.`}
      ${'metadata'} | ${`Field "metadata" of required type "NotificationMetadata!" was not provided.`}
    `(
      `should fail to create a notification since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const notifyParams: NotifyParams = generateNotifyParams();
        delete notifyParams[params.field];
        await handler.mutations.notify({ notifyParams, missingFieldError: params.error });
      },
    );

    test.each`
      field        | input
      ${'textSms'} | ${{ type: NotificationType.textSms }}
      ${'text'}    | ${{ type: NotificationType.text }}
      ${'call'}    | ${{ type: NotificationType.call }}
      ${'video'}   | ${{ type: NotificationType.video }}
    `('should throw an error when metadata is not provided with type $field', async (params) => {
      const notifyParams: NotifyParams = generateNotifyParams({ ...params.input, metadata: {} });
      await handler.mutations.notify({
        notifyParams,
        invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataInvalid)],
      });
    });

    /* eslint-disable-next-line max-len */
    it('Should throw an error when sendBirdChannelUrl field is provided in NotificationMetadata', async () => {
      const notifyParams: NotifyParams = generateNotifyParams({
        metadata: { sendBirdChannelUrl: generateUniqueUrl() },
      });
      const error = 'Field "sendBirdChannelUrl" is not defined by type "NotificationMetadata".';
      await handler.mutations.notify({ notifyParams, missingFieldError: error });
    });

    test.each([NotificationType.text, NotificationType.textSms])(
      'should fail on sending metadata.when in the past for type %p',
      async (type) => {
        const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
        await creators.createAndValidateUser({ orgId });
        const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
        const { id } = await handler.mutations.createMember({ memberParams });
        const member = await handler.queries.getMember({
          id,
          requestHeaders: generateRequestHeaders(memberParams.authId),
        });

        const notifyParams: NotifyParams = generateNotifyParams({
          memberId: member.id,
          userId: member.primaryUserId.toString(),
          type,
          metadata: { peerId: v4(), content: 'test', when: subSeconds(new Date(), 1) },
        });

        await handler.mutations.notify({
          notifyParams,
          invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataWhenPast)],
        });
      },
    );

    test.each([NotificationType.call, NotificationType.video])(
      'should fail on sending metadata.when is provided with not allowed type %p',
      async (type) => {
        const notifyParams: NotifyParams = generateNotifyParams({
          type,
          metadata: { when: date.soon(1) },
        });
        await handler.mutations.notify({
          notifyParams,
          invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataInvalid)],
        });
      },
    );

    it(`should fail on notify with type ${NotificationType.chat}`, async () => {
      const notifyParams: NotifyParams = generateNotifyParams({
        type: NotificationType.chat,
      });
      await handler.mutations.notify({
        notifyParams,
        invalidFieldsErrors: [Errors.get(ErrorType.notificationChatNotSupported)],
      });
    });
  });

  /* eslint-disable max-len */
  describe('cancel', () => {
    test.each`
      input                            | error
      ${{ memberId: 123 }}             | ${stringError}
      ${{ type: 123 }}                 | ${'cannot represent non-string value'}
      ${{ metadata: { peerId: 123 } }} | ${stringError}
    `(`should fail to cancel notification since setting $input is not a valid`, async (params) => {
      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        ...params.input,
      });
      await handler.mutations.cancel({
        cancelNotifyParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                  | invalid
      ${{ memberId: '123' }} | ${[Errors.get(ErrorType.memberIdInvalid)]}
    `(`should fail to cancel notification since setting $input is not valid`, async (params) => {
      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        ...params.input,
      });
      await handler.mutations.cancel({
        cancelNotifyParams,
        invalidFieldsErrors: params.invalid,
      });
    });

    test.each`
      field            | input
      ${'cancelCall'}  | ${{ type: CancelNotificationType.cancelCall }}
      ${'cancelVideo'} | ${{ type: CancelNotificationType.cancelVideo }}
    `('should throw an error when metadata is not provided with type $field', async (params) => {
      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        ...params.input,
        metadata: {},
      });
      await handler.mutations.cancel({
        cancelNotifyParams,
        invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataInvalid)],
      });
    });

    /* eslint-disable max-len */
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'type'}     | ${`Field "type" of required type "CancelNotificationType!" was not provided.`}
      ${'metadata'} | ${`Field "metadata" of required type "CancelNotificationMetadata!" was not provided.`}
    `(
      `should fail to cancel a notification since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams();
        delete cancelNotifyParams[params.field];
        await handler.mutations.cancel({ cancelNotifyParams, missingFieldError: params.error });
      },
    );
  });

  describe('notifyContent', () => {
    test.each`
      field           | error
      ${'memberId'}   | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'userId'}     | ${`Field "userId" of required type "String!" was not provided.`}
      ${'contentKey'} | ${`Field "contentKey" of required type "ExternalKey!" was not provided.`}
    `(`should fail to notify content since mandatory field $field is missing`, async (params) => {
      const notifyContentParams = generateNotifyContentParams();
      delete notifyContentParams[params.field];
      await handler.mutations.notifyContent({
        notifyContentParams,
        missingFieldError: params.error,
      });
    });

    // eslint-disable-next-line max-len
    it(`should fail to notify content since content = ${ExternalKey.answerQuestionnaire} and metadata is not provided`, async () => {
      const notifyContentParams = generateNotifyContentParams({
        contentKey: ExternalKey.answerQuestionnaire,
      });
      delete notifyContentParams.metadata;
      await handler.mutations.notifyContent({
        notifyContentParams,
        invalidFieldsErrors: [Errors.get(ErrorType.notifyContentMetadataInvalid)],
      });
    });
  });

  describe('updateMember', () => {
    /* eslint-disable max-len */
    test.each`
      input                             | error
      ${{ id: 123 }}                    | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ fellowName: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ drgDesc: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ drg: 123 }}                   | ${{ missingFieldError: stringError }}
      ${{ phoneSecondary: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ address: 123 }}               | ${{ missingFieldError: 'Expected type "AddressInput" to be an object.' }}
      ${{ address: { street: 123 } }}   | ${{ missingFieldError: stringError }}
      ${{ address: { city: 123 } }}     | ${{ missingFieldError: stringError }}
      ${{ address: { state: 123 } }}    | ${{ missingFieldError: stringError }}
      ${{ honorific: 'not-valid' }}     | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
      ${{ deviceId: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ deceased: 123 }}              | ${{ missingFieldError: 'Expected type "DeceasedInput" to be an object.' }}
      ${{ deceased: { cause: 123 } }}   | ${{ missingFieldError: stringError }}
      ${{ deceased: { date: 123 } }}    | ${{ missingFieldError: stringError }}
      ${{ healthPlan: 123 }}            | ${{ missingFieldError: stringError }}
    `(`should fail to update a member since setting $input is not a valid`, async (params) => {
      /* eslint-enable max-len */
      const updateMemberParams = generateUpdateMemberParams({ ...params.input });

      await handler.mutations.updateMember({ updateMemberParams, ...params.error });
    });

    const futureDate = generateDateOnly(addDays(new Date(), 1));

    /* eslint-disable max-len */
    test.each`
      field               | input                                                  | errors
      ${'phoneSecondary'} | ${{ phoneSecondary: '+410' }}                          | ${[Errors.get(ErrorType.memberPhone)]}
      ${'dischargeDate'}  | ${{ dischargeDate: lorem.word() }}                     | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'admitDate'}      | ${{ admitDate: lorem.word() }}                         | ${[Errors.get(ErrorType.memberAdmitDate)]}
      ${'admitDate'}      | ${{ admitDate: '2021-13-1' }}                          | ${[Errors.get(ErrorType.memberAdmitDate)]}
      ${'admitDate'}      | ${{ admitDate: new Date() }}                           | ${[Errors.get(ErrorType.memberAdmitDate)]}
      ${'dischargeDate'}  | ${{ dischargeDate: lorem.word() }}                     | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'dischargeDate'}  | ${{ dischargeDate: '2021-13-1' }}                      | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'dischargeDate'}  | ${{ dischargeDate: new Date() }}                       | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'dateOfBirth'}    | ${{ dateOfBirth: lorem.word() }}                       | ${[Errors.get(ErrorType.memberDateOfBirth)]}
      ${'dateOfBirth'}    | ${{ dateOfBirth: '2021-13-1' }}                        | ${[Errors.get(ErrorType.memberDateOfBirth)]}
      ${'deceased'}       | ${{ deceased: { date: futureDate } }}                  | ${[Errors.get(ErrorType.memberDeceasedDateInTheFuture)]}
      ${'deceased'}       | ${{ deceased: { date: '2021-13-1' } }}                 | ${[Errors.get(ErrorType.memberDeceasedDate)]}
      ${'deceased'}       | ${{ deceased: { date: '2021/13/1' } }}                 | ${[Errors.get(ErrorType.memberDeceasedDate)]}
      ${'deceased'}       | ${{ deceased: { date: '2021/07/26T17:30:15+05:30' } }} | ${[Errors.get(ErrorType.memberDeceasedDate)]}
    `(
      /* eslint-enable max-len */
      `should fail to update a member since $field is not valid`,
      async (params) => {
        const updateMemberParams: UpdateMemberParams = generateUpdateMemberParams({
          ...params.input,
        });
        await handler.mutations.updateMember({
          updateMemberParams,
          invalidFieldsErrors: params.errors,
        });
      },
    );
  });

  describe('action items', () => {
    describe('createActionItem', () => {
      /* eslint-disable max-len */
      test.each`
        field         | error
        ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
        ${'title'}    | ${`Field "title" of required type "String!" was not provided.`}
      `(
        /* eslint-enable max-len */
        `should fail to create actionItem since mandatory field $field is missing`,
        async (params) => {
          const createActionItemParams = generateCreateActionItemParams();
          delete createActionItemParams[params.field];
          await handler.mutations.createActionItem({
            createActionItemParams,
            missingFieldError: params.error,
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        input                        | error
        ${{ memberId: 123 }}         | ${{ missingFieldError: stringError }}
        ${{ title: 123 }}            | ${{ missingFieldError: stringError }}
        ${{ description: 123 }}      | ${{ missingFieldError: stringError }}
        ${{ status: 123 }}           | ${`Field "status" of required type "ActionItemStatus!" was not provided.`}
        ${{ priority: 123 }}         | ${`Field "priority" of required type "ActionItemPriority!" was not provided.`}
        ${{ category: 123 }}         | ${`Field "category" of required type "ActionItemCategory!" was not provided.`}
        ${{ deadline: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.journeyActionItemDeadline)] }}
      `(
        /* eslint-enable max-len */
        `should fail to create actionItem since setting $input is not a valid type`,
        async (params) => {
          const createActionItemParams = generateCreateActionItemParams({ ...params.input });
          await handler.mutations.createActionItem({ createActionItemParams, ...params.error });
        },
      );
    });

    describe('updateActionItem', () => {
      /* eslint-disable max-len */
      test.each`
        field       | error
        ${'id'}     | ${`Field "id" of required type "String!" was not provided.`}
        ${'status'} | ${`Field "status" of required type "ActionItemStatus!" was not provided.`}
      `(
        /* eslint-enable max-len */
        `should fail to update actionItem since mandatory field $field is missing`,
        async (params) => {
          const updateActionItemParams = generateUpdateActionItemParams();
          delete updateActionItemParams[params.field];
          await handler.mutations.updateActionItem({
            updateActionItemParams,
            missingFieldError: params.error,
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        input              | error
        ${{ id: 123 }}     | ${stringError}
        ${{ status: 123 }} | ${'Enum "ActionItemStatus" cannot represent non-string value'}
      `(`should fail to update actionItem since $input is not a valid type`, async (params) => {
        /* eslint-enable max-len */
        const updateActionItemParams = generateUpdateActionItemParams({
          ...params.input,
        });
        await handler.mutations.updateActionItem({
          updateActionItemParams,
          missingFieldError: params.error,
        });
      });
    });
  });

  describe('updateJournalText', () => {
    test.each`
      field     | error
      ${'id'}   | ${`Field "id" of required type "String!" was not provided.`}
      ${'text'} | ${`Field "text" of required type "String!" was not provided.`}
    `(`should fail to update journal since mandatory field $field is missing`, async (params) => {
      const updateJournalTextParams = generateUpdateJournalTextParams();
      delete updateJournalTextParams[params.field];
      await handler.mutations.updateJournalText({
        updateJournalTextParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: params.error,
      });
    });

    it(`should fail update journal text since string is empty)`, async () => {
      await handler.mutations.updateJournalText({
        updateJournalTextParams: generateUpdateJournalTextParams({ text: '' }),
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: 'text should not be empty',
      });
    });

    test.each`
      input            | error
      ${{ id: 123 }}   | ${stringError}
      ${{ text: 123 }} | ${stringError}
    `(
      `should fail to update journal since $input is not a valid type (indicated as missing)`,
      async (params) => {
        const updateJournalTextParams = generateUpdateJournalTextParams({ ...params.input });
        await handler.mutations.updateJournalText({
          updateJournalTextParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      input            | invalid
      ${{ id: '123' }} | ${[Errors.get(ErrorType.journeyJournalIdInvalid)]}
    `(`should fail to update journal since $input is not a valid type`, async (params) => {
      const updateJournalTextParams = generateUpdateJournalTextParams({ ...params.input });
      await handler.mutations.updateJournalText({
        updateJournalTextParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        invalidFieldsErrors: params.invalid,
      });
    });
  });

  describe('getJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.queries.getJournal({
        id: 123,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        invalidFieldsError: stringError,
      });
    });
  });

  describe('deleteJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournal({
        id: 123,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: stringError,
      });
    });

    test.each`
      field    | error
      ${'123'} | ${Errors.get(ErrorType.journeyJournalIdInvalid)}
    `(`should fail to get recordings by member id - value $field is invalid`, async (params) => {
      await handler.mutations.deleteJournal({
        id: params.field,
        invalidFieldsErrors: [params.error],
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });
    });
  });

  describe('getMemberUploadJournalImageLinks', () => {
    test.each`
      field            | error
      ${'id'}          | ${`Field "id" of required type "String!" was not provided.`}
      ${'imageFormat'} | ${`Field "imageFormat" of required type "ImageFormat!" was not provided.`}
    `(
      `should fail to get journal upload image link since mandatory field $field is missing`,
      async (params) => {
        const getMemberUploadJournalImageLinkParams =
          generateGetMemberUploadJournalImageLinkParams();
        delete getMemberUploadJournalImageLinkParams[params.field];
        await handler.queries.getMemberUploadJournalImageLink({
          getMemberUploadJournalImageLinkParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          missingFieldError: params.error,
        });
      },
    );

    /* eslint-disable max-len */
    test.each`
      input                   | error
      ${{ id: 123 }}          | ${stringError}
      ${{ imageFormat: 123 }} | ${`Enum "ImageFormat" cannot represent non-string value`}
    `(
      `should fail to get journal upload image link since $input is not a valid type (indicated as missing)`,
      async (params) => {
        const getMemberUploadJournalImageLinkParams = generateGetMemberUploadJournalImageLinkParams(
          {
            ...params.input,
          },
        );
        await handler.queries.getMemberUploadJournalImageLink({
          getMemberUploadJournalImageLinkParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      input            | invalid
      ${{ id: '123' }} | ${[Errors.get(ErrorType.journeyJournalIdInvalid)]}
    `(
      `should fail to get journal upload image link since $input is not a valid type`,
      async (params) => {
        const getMemberUploadJournalImageLinkParams = generateGetMemberUploadJournalImageLinkParams(
          {
            ...params.input,
          },
        );
        await handler.queries.getMemberUploadJournalImageLink({
          getMemberUploadJournalImageLinkParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          invalidFieldsErrors: params.invalid,
        });
      },
    );
  });

  describe('getMemberUploadJournalAudioLink', () => {
    test.each`
      field            | error
      ${'id'}          | ${`Field "id" of required type "String!" was not provided.`}
      ${'audioFormat'} | ${`Field "audioFormat" of required type "AudioFormat!" was not provided.`}
    `(
      `should fail to get journal upload audio link since mandatory field $field is missing`,
      async (params) => {
        const getMemberUploadJournalAudioLinkParams =
          generateGetMemberUploadJournalAudioLinkParams();
        delete getMemberUploadJournalAudioLinkParams[params.field];
        await handler.queries.getMemberUploadJournalAudioLink({
          getMemberUploadJournalAudioLinkParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          invalidFieldsError: params.error,
        });
      },
    );

    test.each`
      field                   | error
      ${{ id: 123 }}          | ${stringError}
      ${{ audioFormat: 123 }} | ${`Enum "AudioFormat" cannot represent non-string value`}
    `(
      `should fail to get journal upload audio link since $input is not a valid type`,
      async (params) => {
        const getMemberUploadJournalAudioLinkParams = generateGetMemberUploadJournalAudioLinkParams(
          {
            ...params.field,
          },
        );
        await handler.queries.getMemberUploadJournalAudioLink({
          getMemberUploadJournalAudioLinkParams,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
          invalidFieldsError: params.error,
        });
      },
    );
  });

  describe('deleteJournalImage', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournalImage({
        id: 123,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: stringError,
      });
    });
  });

  describe('deleteJournalAudio', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournalAudio({
        id: 123,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: stringError,
      });
    });
  });

  describe('publishJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.publishJournal({
        id: 123,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        missingFieldError: stringError,
      });
    });
  });

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

  describe('replaceUserForMember', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'userId'}   | ${`Field "userId" of required type "String!" was not provided.`}
    `(`should fail to set new user to member if field $field is missing`, async (params) => {
      const replaceUserForMemberParams = generateReplaceUserForMemberParams();
      delete replaceUserForMemberParams[params.field];
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                | error
      ${{ memberId: 123 }} | ${stringError}
      ${{ userId: 123 }}   | ${stringError}
    `(`should fail to set new user to member since $input is not a valid type`, async (params) => {
      const replaceUserForMemberParams = generateReplaceUserForMemberParams({ ...params.input });
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                  | invalid
      ${{ memberId: '123' }} | ${[Errors.get(ErrorType.memberIdInvalid)]}
      ${{ userId: '123' }}   | ${[Errors.get(ErrorType.userIdInvalid)]}
    `(`should fail to set new user to member since $input is not a valid type`, async (params) => {
      const replaceUserForMemberParams = generateReplaceUserForMemberParams({ ...params.input });
      await handler.mutations.replaceUserForMember({
        replaceUserForMemberParams,
        invalidFieldsErrors: params.invalid,
      });
    });
  });

  describe('replaceMemberOrg', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'orgId'}    | ${`Field "orgId" of required type "String!" was not provided.`}
    `(`should fail to replace member org since missing $field`, async (params) => {
      const replaceMemberOrgParams = generateReplaceMemberOrgParams();
      delete replaceMemberOrgParams[params.field];
      await handler.mutations.replaceMemberOrg({
        replaceMemberOrgParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                | error
      ${{ memberId: 123 }} | ${stringError}
      ${{ orgId: 123 }}    | ${stringError}
    `(`should fail to replace member org since $input is not a valid`, async (params) => {
      const replaceMemberOrgParams = generateReplaceMemberOrgParams({ ...params.input });
      await handler.mutations.replaceMemberOrg({
        replaceMemberOrgParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                  | invalid
      ${{ memberId: '123' }} | ${[Errors.get(ErrorType.memberIdInvalid)]}
      ${{ orgId: '123' }}    | ${[Errors.get(ErrorType.orgIdInvalid)]}
    `(`should fail to replace member org since $input is not a valid`, async (params) => {
      const replaceMemberOrgParams = generateReplaceMemberOrgParams({ ...params.input });
      await handler.mutations.replaceMemberOrg({
        replaceMemberOrgParams,
        invalidFieldsErrors: params.invalid,
      });
    });

    it('should fail to replace member org if role not admin', async () => {
      await handler.mutations.replaceMemberOrg({
        replaceMemberOrgParams: generateReplaceMemberOrgParams(),
        requestHeaders: handler.defaultUserRequestHeaders,
        missingFieldError: 'Forbidden resource',
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
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        });
      });
    });

    describe('getCaregivers', () => {
      test.each`
        input    | error
        ${'123'} | ${[Errors.get(ErrorType.memberIdInvalid)]}
        ${123}   | ${stringError}
      `(`should fail to get caregivers by member id $input is not a valid type`, async (params) => {
        await handler.queries.getCaregivers({
          memberId: params.input,
          invalidFieldsError: params.error,
          requestHeaders: generateRequestHeaders(handler.patientZero.authId),
        });
      });
    });
  });

  describe('deleteMember', () => {
    test.each`
      input            | error
      ${{ id: 123 }}   | ${stringError}
      ${{ hard: 123 }} | ${BooleanError}
    `(`should fail to set new user to member since $input is not a valid type`, async (params) => {
      const deleteMemberParams = generateDeleteMemberParams({ ...params.input });
      await handler.mutations.deleteMember({
        deleteMemberParams,
        missingFieldError: params.error,
      });
    });

    it('should throw error on non existing member', async () => {
      const deleteMemberParams = generateDeleteMemberParams();
      await handler.mutations.deleteMember({
        deleteMemberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberNotFound)],
      });
    });
  });
});
