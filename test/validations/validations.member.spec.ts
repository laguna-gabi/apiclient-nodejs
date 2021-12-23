import {
  CancelNotificationType,
  Honorific,
  Language,
  NotificationType,
  Platform,
  generateZipCode,
} from '@lagunahealth/pandora';
import * as config from 'config';
import { subSeconds } from 'date-fns';
import * as faker from 'faker';
import * as request from 'supertest';
import { ErrorType, Errors } from '../../src/common';
import {
  AddCaregiverParams,
  CancelNotifyParams,
  CreateMemberParams,
  NotifyParams,
  Sex,
  UpdateMemberParams,
  defaultMemberParams,
} from '../../src/member';
import { Handler } from '../aux/handler';
import {
  generateAddCaregiverParams,
  generateCancelNotifyParams,
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateDateOnly,
  generateGetMemberUploadJournalAudioLinkParams,
  generateGetMemberUploadJournalImageLinkParams,
  generateId,
  generateNotifyParams,
  generateOrgParams,
  generateRandomName,
  generateReplaceUserForMemberParams,
  generateSetGeneralNotesParams,
  generateUniqueUrl,
  generateUpdateJournalTextParams,
  generateUpdateMemberParams,
  generateUpdateRecordingParams,
  generateUpdateTaskStatusParams,
  urls,
} from '../index';
import { v4 } from 'uuid';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();
  let server;

  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    await handler.beforeAll();
    await handler.mutations.createUser({ userParams: generateCreateUserParams() });
    server = handler.app.getHttpServer();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

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
      ${'language'}      | ${defaultMemberParams.language}
      ${'dischargeDate'} | ${null}
      ${'honorific'}     | ${defaultMemberParams.honorific}
    `(`should set default value if exists for optional field $field`, async (params) => {
      /* eslint-enable max-len */
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      delete memberParams[params.field];

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.setContextUserId(id).queries.getMember({ id });
      expect(member[params.field]).toEqual(params.defaultValue);
    });

    test.each`
      field          | value
      ${'sex'}       | ${Sex.female}
      ${'email'}     | ${faker.internet.email()}
      ${'language'}  | ${Language.es}
      ${'zipCode'}   | ${generateZipCode()}
      ${'honorific'} | ${Honorific.dr}
    `(`should be able to set value for optional field $field`, async (params) => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      memberParams[params.field] = params.value;

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.setContextUserId(id).queries.getMember({ id });
      expect(member[params.field]).toEqual(params.value);
    });

    it('should set value for optional field dischargeDate', async () => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });

      memberParams.dischargeDate = generateDateOnly(faker.date.soon(3));

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.setContextUserId(id).queries.getMember({ id });
      expect(generateDateOnly(new Date(member.dischargeDate))).toEqual(memberParams.dischargeDate);
    });

    /* eslint-disable max-len */
    test.each`
      input                             | error
      ${{ phone: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ orgId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ zipCode: '123' }}             | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberInvalidZipCode)] }}
      ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dateOfBirth: '2021/13/1' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ dischargeDate: '2021/13/1' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ honorific: 'not-valid' }}     | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
      ${{ userId: 'not-valid' }}        | ${{ invalidFieldsErrors: [Errors.get(ErrorType.userIdInvalid)] }}
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

    /* eslint-disable max-len */
    test.each`
      field            | input                                  | errors
      ${'phone'}       | ${{ phone: '+410' }}                   | ${[Errors.get(ErrorType.memberPhone)]}
      ${'dateOfBirth'} | ${{ dateOfBirth: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDateOfBirth)]}
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
      await handler.setContextUserId(generateId()).queries.getMember({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    it('should throw error on non existing member from mobile', async () => {
      await handler
        .setContextUserId(generateId())
        .queries.getMember({ invalidFieldsError: Errors.get(ErrorType.memberNotFound) });
    });

    it('rest: should fail to create member if phone already exists', async () => {
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId: generateId() });
      await handler.mutations.createMember({ memberParams });
      const newMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        phone: memberParams.phone,
      });
      await request(server).post(urls.members).send(newMemberParams).expect(400);
    });
  });

  describe('getMemberUploadDischargeDocumentsLinks', () => {
    it('should fail to get upload links since mandatory field id is missing', async () => {
      await handler.queries.getMemberUploadDischargeDocumentsLinks({
        missingFieldError: 'Expected non-nullable type "String!" not to be null.',
      });
    });

    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberUploadDischargeDocumentsLinks({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('getMemberDownloadDischargeDocumentsLinks', () => {
    it('should throw error on non existing member', async () => {
      await handler
        .setContextUserId(generateId())
        .queries.getMemberDownloadDischargeDocumentsLinks({
          id: generateId(),
          invalidFieldsError: Errors.get(ErrorType.memberNotFound),
        });
    });
  });

  describe('getMemberUploadRecordingLink', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberUploadRecordingLink({
        recordingLinkParams: { memberId: generateId(), id: generateId() },
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('getMemberDownloadRecordingLink', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberDownloadRecordingLink({
        recordingLinkParams: { memberId: generateId(), id: generateId() },
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('getMemberConfig', () => {
    it('should throw error on non existing member', async () => {
      await handler.setContextUserId(generateId()).queries.getMemberConfig({
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('registerForNotificationParams', () => {
    test.each(['a-b', 'a_b'])(
      'should not be able to register on non alphanumeric token %p',
      async (token) => {
        await handler.setContextUserId(generateId()).mutations.registerMemberForNotifications({
          registerForNotificationParams: { platform: Platform.ios, token },
          invalidFieldsErrors: [Errors.get(ErrorType.memberRegisterForNotificationToken)],
        });
      },
    );
  });

  describe('notify', () => {
    test.each`
      input                             | error
      ${{ userId: 123 }}                | ${stringError}
      ${{ memberId: 123 }}              | ${stringError}
      ${{ metadata: { content: 123 } }} | ${stringError}
      ${{ metadata: { peerId: 123 } }}  | ${stringError}
      ${{ type: 123 }}                  | ${'cannot represent non-string value'}
    `(`should fail to notify since setting $input is not a valid`, async (params) => {
      const notifyParams: NotifyParams = generateNotifyParams({ ...params.input });
      await handler.mutations.notify({ notifyParams, missingFieldError: params.error });
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
        const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
        const { id } = await handler.mutations.createMember({ memberParams });
        const member = await handler.setContextUserId(id).queries.getMember({ id });

        const notifyParams: NotifyParams = generateNotifyParams({
          memberId: member.id,
          userId: member.primaryUserId,
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
          metadata: { when: faker.date.soon(1) },
        });
        await handler.mutations.notify({
          notifyParams,
          invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataInvalid)],
        });
      },
    );

    test.each([NotificationType.call, NotificationType.video])(
      'should fail on sending metadata.chatLink is provided with not allowed type %p',
      async (type) => {
        const notifyParams: NotifyParams = generateNotifyParams({
          type,
          metadata: { chatLink: true },
        });
        await handler.mutations.notify({
          notifyParams,
          invalidFieldsErrors: [Errors.get(ErrorType.notificationMetadataInvalid)],
        });
      },
    );
  });

  describe('cancel', () => {
    test.each`
      input                            | error
      ${{ memberId: 123 }}             | ${stringError}
      ${{ type: 123 }}                 | ${'cannot represent non-string value'}
      ${{ notificationId: 123 }}       | ${stringError}
      ${{ metadata: { peerId: 123 } }} | ${stringError}
    `(`should fail to cancel notification since setting $input is not a valid`, async (params) => {
      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        ...params.input,
      });
      await handler.mutations.cancel({ cancelNotifyParams, missingFieldError: params.error });
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
      field               | error
      ${'memberId'}       | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'type'}           | ${`Field "type" of required type "CancelNotificationType!" was not provided.`}
      ${'notificationId'} | ${`Field "notificationId" of required type "String!" was not provided.`}
      ${'metadata'}       | ${`Field "metadata" of required type "CancelNotificationMetadata!" was not provided.`}
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

  describe('updateMember', () => {
    /* eslint-disable max-len */
    test.each`
      input                               | error
      ${{ id: 123 }}                      | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}                | ${{ missingFieldError: stringError }}
      ${{ fellowName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ drgDesc: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ drg: 123 }}                     | ${{ missingFieldError: stringError }}
      ${{ readmissionRisk: 'not-valid' }} | ${{ missingFieldError: 'does not exist in "ReadmissionRisk" enum' }}
      ${{ phoneSecondary: 123 }}          | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}           | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}             | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}        | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ dischargeDate: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ address: 123 }}                 | ${{ missingFieldError: 'Expected type "AddressInput" to be an object.' }}
      ${{ address: { street: 123 } }}     | ${{ missingFieldError: stringError }}
      ${{ address: { city: 123 } }}       | ${{ missingFieldError: stringError }}
      ${{ address: { state: 123 } }}      | ${{ missingFieldError: stringError }}
      ${{ honorific: 'not-valid' }}       | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
      ${{ deviceId: 123 }}                | ${{ missingFieldError: stringError }}
    `(`should fail to update a member since setting $input is not a valid`, async (params) => {
      /* eslint-enable max-len */
      const updateMemberParams = generateUpdateMemberParams({ ...params.input });

      await handler.mutations.updateMember({ updateMemberParams, ...params.error });
    });

    /* eslint-disable max-len */
    test.each`
      field               | input                                    | errors
      ${'phoneSecondary'} | ${{ phoneSecondary: '+410' }}            | ${[Errors.get(ErrorType.memberPhone)]}
      ${'dischargeDate'}  | ${{ dischargeDate: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'admitDate'}      | ${{ admitDate: faker.lorem.word() }}     | ${[Errors.get(ErrorType.memberAdmitDate)]}
      ${'admitDate'}      | ${{ admitDate: '2021/13/1' }}            | ${[Errors.get(ErrorType.memberAdmitDate)]}
      ${'dischargeDate'}  | ${{ dischargeDate: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'dischargeDate'}  | ${{ dischargeDate: '2021/13/1' }}        | ${[Errors.get(ErrorType.memberDischargeDate)]}
      ${'dateOfBirth'}    | ${{ dateOfBirth: faker.lorem.word() }}   | ${[Errors.get(ErrorType.memberDateOfBirth)]}
      ${'dateOfBirth'}    | ${{ dateOfBirth: '2021/13/1' }}          | ${[Errors.get(ErrorType.memberDateOfBirth)]}
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

  describe('goal + action items', () => {
    enum TaskType {
      goal = 'goal',
      actionItem = 'actionItem',
    }

    describe('createGoal + createActionItem', () => {
      /* eslint-disable max-len */
      test.each`
        field         | taskType               | error
        ${'memberId'} | ${TaskType.goal}       | ${`Field "memberId" of required type "String!" was not provided.`}
        ${'title'}    | ${TaskType.goal}       | ${`Field "title" of required type "String!" was not provided.`}
        ${'deadline'} | ${TaskType.goal}       | ${`Field "deadline" of required type "DateTime!" was not provided.`}
        ${'memberId'} | ${TaskType.actionItem} | ${`Field "memberId" of required type "String!" was not provided.`}
        ${'title'}    | ${TaskType.actionItem} | ${`Field "title" of required type "String!" was not provided.`}
        ${'deadline'} | ${TaskType.actionItem} | ${`Field "deadline" of required type "DateTime!" was not provided.`}
      `(
        /* eslint-enable max-len */
        `should fail to create $taskType since mandatory field $field is missing`,
        async (params) => {
          const createTaskParams = generateCreateTaskParams();
          delete createTaskParams[params.field];
          const method = TaskType.goal
            ? handler.mutations.createGoal
            : handler.mutations.createActionItem;
          await method({ createTaskParams, missingFieldError: params.error });
        },
      );

      /* eslint-disable max-len */
      test.each`
        input                        | taskType               | error
        ${{ memberId: 123 }}         | ${TaskType.goal}       | ${{ missingFieldError: stringError }}
        ${{ title: 123 }}            | ${TaskType.goal}       | ${{ missingFieldError: stringError }}
        ${{ deadline: 'not-valid' }} | ${TaskType.goal}       | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberTaskDeadline)] }}
        ${{ memberId: 123 }}         | ${TaskType.actionItem} | ${{ missingFieldError: stringError }}
        ${{ title: 123 }}            | ${TaskType.actionItem} | ${{ missingFieldError: stringError }}
        ${{ deadline: 'not-valid' }} | ${TaskType.actionItem} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberTaskDeadline)] }}
      `(
        /* eslint-enable max-len */
        `should fail to create $taskType since setting $input is not a valid type`,
        async (params) => {
          const createTaskParams = generateCreateTaskParams({ ...params.input });
          const method = TaskType.goal
            ? handler.mutations.createGoal
            : handler.mutations.createActionItem;
          await method({ createTaskParams, ...params.error });
        },
      );
    });

    describe('updateGoalStatus + updateActionItemStatus', () => {
      /* eslint-disable max-len */
      test.each`
        field       | taskType               | error
        ${'id'}     | ${TaskType.goal}       | ${`Field "id" of required type "String!" was not provided.`}
        ${'status'} | ${TaskType.goal}       | ${`Field "status" of required type "TaskStatus!" was not provided.`}
        ${'id'}     | ${TaskType.actionItem} | ${`Field "id" of required type "String!" was not provided.`}
        ${'status'} | ${TaskType.actionItem} | ${`Field "status" of required type "TaskStatus!" was not provided.`}
      `(
        /* eslint-enable max-len */
        `should fail to update $taskType since mandatory field $field is missing`,
        async (params) => {
          const updateTaskStatusParams = generateUpdateTaskStatusParams();
          delete updateTaskStatusParams[params.field];
          const method = TaskType.goal
            ? handler.mutations.updateGoalStatus
            : handler.mutations.updateActionItemStatus;
          await method({ updateTaskStatusParams, missingFieldError: params.error });
        },
      );

      /* eslint-disable max-len */
      test.each`
        input              | taskType               | error
        ${{ id: 123 }}     | ${TaskType.goal}       | ${stringError}
        ${{ status: 123 }} | ${TaskType.goal}       | ${'Enum "TaskStatus" cannot represent non-string value'}
        ${{ id: 123 }}     | ${TaskType.actionItem} | ${stringError}
        ${{ status: 123 }} | ${TaskType.actionItem} | ${'Enum "TaskStatus" cannot represent non-string value'}
      `(`should fail to update $taskType since $input is not a valid type`, async (params) => {
        /* eslint-enable max-len */
        const updateTaskStatusParams = generateUpdateTaskStatusParams({ ...params.input });
        const method = TaskType.goal
          ? handler.mutations.updateGoalStatus
          : handler.mutations.updateActionItemStatus;
        await method({ updateTaskStatusParams, missingFieldError: params.error });
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
        missingFieldError: params.error,
      });
    });

    test.each`
      field
      ${{ id: 123 }}
      ${{ text: 123 }}
    `(`should fail to update journal since $input is not a valid type`, async (params) => {
      const updateJournalTextParams = generateUpdateJournalTextParams({ ...params.field });
      await handler.mutations.updateJournalText({
        updateJournalTextParams,
        missingFieldError: stringError,
      });
    });
  });

  describe('getJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.queries.getJournal({
        id: 123,
        invalidFieldsError: stringError,
      });
    });
  });

  describe('deleteJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournal({
        id: 123,
        missingFieldError: stringError,
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
          invalidFieldsError: params.error,
        });
      },
    );

    test.each`
      field                   | error
      ${{ id: 123 }}          | ${stringError}
      ${{ imageFormat: 123 }} | ${`Enum "ImageFormat" cannot represent non-string value`}
    `(
      `should fail to get journal upload image link since $input is not a valid type`,
      async (params) => {
        const getMemberUploadJournalImageLinkParams = generateGetMemberUploadJournalImageLinkParams(
          {
            ...params.field,
          },
        );
        await handler.queries.getMemberUploadJournalImageLink({
          getMemberUploadJournalImageLinkParams,
          invalidFieldsError: params.error,
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
          invalidFieldsError: params.error,
        });
      },
    );
  });

  describe('deleteJournalImage', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournalImage({
        id: 123,
        missingFieldError: stringError,
      });
    });
  });

  describe('deleteJournalAudio', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.deleteJournalAudio({
        id: 123,
        missingFieldError: stringError,
      });
    });
  });

  describe('publishJournal', () => {
    it('should throw an error for invalid id', async () => {
      await handler.mutations.publishJournal({
        id: 123,
        missingFieldError: stringError,
      });
    });
  });

  describe('updateRecording', () => {
    test.each`
      field         | error
      ${'id'}       | ${`Field "id" of required type "String!" was not provided.`}
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
      input                | error
      ${{ id: 123 }}       | ${stringError}
      ${{ memberId: 123 }} | ${stringError}
      ${{ userId: 123 }}   | ${stringError}
      ${{ answered: 123 }} | ${'Boolean cannot represent a non boolean value'}
      ${{ phone: 123 }}    | ${stringError}
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
  });

  describe('caregiver', () => {
    describe('addCaregiver - invalid and missing fields', () => {
      /* eslint-disable max-len */
      test.each`
        field             | error
        ${'firstName'}    | ${`Field "firstName" of required type "String!" was not provided.`}
        ${'lastName'}     | ${`Field "lastName" of required type "String!" was not provided.`}
        ${'email'}        | ${`Field "email" of required type "String!" was not provided.`}
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
        input                   | error
        ${{ email: 'invalid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverEmailInvalid)] }}
        ${{ phone: 'invalid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.caregiverPhoneInvalid)] }}
      `(
        /* eslint-enable max-len */
        `should fail to add a caregiver due to invalid $input field`,
        async (params) => {
          const addCaregiverParams: AddCaregiverParams = generateAddCaregiverParams({
            ...params.input,
          });

          await handler.setContextUserId(handler.patientZero.id).mutations.addCaregiver({
            addCaregiverParams,
            ...params.error,
          });
        },
      );
    });
  });

  describe('archiveMember', () => {
    it('should throw error on non existing member', async () => {
      await handler.mutations.archiveMember({
        id: generateId(),
        invalidFieldsErrors: [Errors.get(ErrorType.memberNotFound)],
      });
    });
  });
});
