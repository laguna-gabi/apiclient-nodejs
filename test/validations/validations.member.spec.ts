import * as request from 'supertest';
import {
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateDateOnly,
  generateId,
  generateNotifyParams,
  generateCancelNotifyParams,
  generateOrgParams,
  generateRandomName,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
  generateUpdateTaskStatusParams,
  generateZipCode,
  urls,
} from '../index';
import * as config from 'config';
import * as faker from 'faker';
import {
  CancelNotifyParams,
  CreateMemberParams,
  defaultMemberParams,
  NotifyParams,
  Sex,
  UpdateMemberParams,
  getHonorificKeyName,
} from '../../src/member';
import {
  Errors,
  ErrorType,
  Language,
  Platform,
  NotificationType,
  CancelNotificationType,
} from '../../src/common';
import { Handler } from '../aux/handler';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();
  let server;

  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    await handler.beforeAll();
    await handler.mutations.createUser({
      userParams: generateCreateUserParams(),
    });
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
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
      });
      delete memberParams[params.field];
      await handler.mutations.createMember({
        memberParams,
        missingFieldError: params.error,
      });
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
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
      });
      delete memberParams[params.field];

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({ id });
      expect(member[params.field]).toEqual(params.defaultValue);
    });

    test.each`
      field          | value
      ${'sex'}       | ${Sex.female}
      ${'email'}     | ${faker.internet.email()}
      ${'language'}  | ${Language.es}
      ${'zipCode'}   | ${generateZipCode()}
      ${'honorific'} | ${getHonorificKeyName(config.get('contents.honorific.dr'))}
    `(`should be able to set value for optional field $field`, async (params) => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });
      memberParams[params.field] = params.value;

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({ id });
      expect(member[params.field]).toEqual(params.value);
    });

    it('should set value for optional field dischargeDate', async () => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const memberParams: CreateMemberParams = generateCreateMemberParams({ orgId });

      memberParams.dischargeDate = generateDateOnly(faker.date.soon(3));

      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember({ id });
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
      ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dateOfBirth: '2021/13/1' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ dischargeDate: '2021/13/1' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ honorific: 'not-valid' }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberInvalidHonorific)] }}
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
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
      });
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
        await handler.mutations.createMember({
          memberParams,
          invalidFieldsErrors: params.errors,
        });
      },
    );

    it('should throw error on non existing member from web', async () => {
      await handler.queries.getMember({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    it('should throw error on non existing member from mobile', async () => {
      handler.setContextUser('not-valid');
      await handler.queries.getMember({
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });

    it('rest: should fail to create member if phone already exists', async () => {
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
      });
      await handler.mutations.createMember({
        memberParams,
      });
      const newMemberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        phone: memberParams.phone,
      });
      await request(server).post(urls.members).send(newMemberParams).expect(400);
    });
  });

  describe('getMemberDischargeDocumentsLinks', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberDischargeDocumentsLinks({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('getMemberConfig', () => {
    it('should throw error on non existing member', async () => {
      await handler.queries.getMemberConfig({
        id: generateId(),
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
      });
    });
  });

  describe('registerForNotificationParams', () => {
    test.each(['a-b', 'a_b'])(
      'should not be able to register on non alphanumeric token %p',
      async (token) => {
        await handler.mutations.registerMemberForNotifications({
          registerForNotificationParams: {
            memberId: generateId(),
            platform: Platform.ios,
            token,
          },
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

    /* eslint-disable max-len */
    test.each`
      field        | input                                 | error
      ${'textSms'} | ${{ type: NotificationType.textSms }} | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
      ${'text'}    | ${{ type: NotificationType.text }}    | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
      ${'call'}    | ${{ type: NotificationType.call }}    | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
      ${'video'}   | ${{ type: NotificationType.video }}   | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
    `('should throw an error when metadata is not provided with type $field', async (params) => {
      /* eslint-enable max-len */
      const notifyParams: NotifyParams = generateNotifyParams({ ...params.input, metadata: {} });
      await handler.mutations.notify({ notifyParams, invalidFieldsErrors: params.error });
    });

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

    /* eslint-disable max-len */
    test.each`
      field            | input                                           | error
      ${'cancelCall'}  | ${{ type: CancelNotificationType.cancelCall }}  | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
      ${'cancelVideo'} | ${{ type: CancelNotificationType.cancelVideo }} | ${[Errors.get(ErrorType.notificationMetadataInvalid)]}
    `('should throw an error when metadata is not provided with type $field', async (params) => {
      /* eslint-enable max-len */
      const cancelNotifyParams: CancelNotifyParams = generateCancelNotifyParams({
        ...params.input,
        metadata: {},
      });
      await handler.mutations.cancel({ cancelNotifyParams, invalidFieldsErrors: params.error });
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
        await handler.mutations.cancel({
          cancelNotifyParams,
          missingFieldError: params.error,
        });
      },
    );
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
      ${{ readmissionRisk: 123 }}       | ${{ missingFieldError: stringError }}
      ${{ phoneSecondary: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ address: 123 }}               | ${{ missingFieldError: 'Expected type "AddressInput" to be an object.' }}
      ${{ address: { street: 123 } }}   | ${{ missingFieldError: stringError }}
      ${{ address: { city: 123 } }}     | ${{ missingFieldError: stringError }}
      ${{ address: { state: 123 } }}    | ${{ missingFieldError: stringError }}
      ${{ honorific: 'not-valid' }}     | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberInvalidHonorific)] }}
      ${{ deviceId: 123 }}              | ${{ missingFieldError: stringError }}
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
          await method({
            updateTaskStatusParams,
            missingFieldError: params.error,
          });
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
        await method({
          updateTaskStatusParams,
          missingFieldError: params.error,
        });
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
      field                | error
      ${{ memberId: 123 }} | ${stringError}
      ${{ note: 123 }}     | ${stringError}
    `(`should fail to set general notes since $input is not a valid type`, async (params) => {
      const setGeneralNotesParams = generateSetGeneralNotesParams({ ...params.field });
      await handler.mutations.setGeneralNotes({
        setGeneralNotesParams,
        missingFieldError: params.error,
      });
    });
  });
});
