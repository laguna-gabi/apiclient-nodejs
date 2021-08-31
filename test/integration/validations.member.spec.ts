import {
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateDateOnly,
  generateId,
  generateNotifyParams,
  generateOrgParams,
  generateRandomName,
  generateSetGeneralNotesParams,
  generateUpdateMemberParams,
  generateUpdateTaskStatusParams,
  generateZipCode,
} from '../index';
import * as config from 'config';
import * as faker from 'faker';
import {
  CreateMemberParams,
  defaultMemberParams,
  Honorific,
  NotifyParams,
  Sex,
  UpdateMemberParams,
} from '../../src/member';
import { Errors, ErrorType, Language, Platform, NotificationType } from '../../src/common';
import { Handler } from './aux/handler';
import { v4 } from 'uuid';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();

  const minLength = validatorsConfig.get('name.minLength') as number;
  const maxLength = validatorsConfig.get('name.maxLength') as number;

  beforeAll(async () => {
    await handler.beforeAll();
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createMember + getMember', () => {
    /* eslint-disable max-len */
    test.each`
      field              | error
      ${'phone'}         | ${`Field "phone" of required type "String!" was not provided.`}
      ${'firstName'}     | ${`Field "firstName" of required type "String!" was not provided.`}
      ${'lastName'}      | ${`Field "lastName" of required type "String!" was not provided.`}
      ${'dateOfBirth'}   | ${`Field "dateOfBirth" of required type "String!" was not provided.`}
      ${'primaryUserId'} | ${`Field "primaryUserId" of required type "String!" was not provided.`}
      ${'usersIds'}      | ${`Field "usersIds" of required type "[String!]!" was not provided.`}
    `(`should fail to create a member since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const primaryUserId = v4();
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        primaryUserId,
        usersIds: [primaryUserId],
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
      const { id: primaryUserId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryUserId,
        usersIds: [primaryUserId],
      });
      delete memberParams[params.field];

      handler.setContextUser(memberParams.deviceId);
      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember();
      expect(member[params.field]).toEqual(params.defaultValue);
    });

    test.each`
      field          | value
      ${'sex'}       | ${Sex.female}
      ${'email'}     | ${faker.internet.email()}
      ${'language'}  | ${Language.es}
      ${'zipCode'}   | ${generateZipCode()}
      ${'honorific'} | ${Honorific.Reverend}
    `(`should be able to set value for optional field $field`, async (params) => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const { id: primaryUserId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryUserId,
        usersIds: [primaryUserId],
      });
      memberParams[params.field] = params.value;

      handler.setContextUser(memberParams.deviceId);
      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember();
      expect(member[params.field]).toEqual(params.value);
    });

    it('should set value for optional field dischargeDate', async () => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const { id: primaryUserId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryUserId,
        usersIds: [primaryUserId],
      });

      memberParams.dischargeDate = generateDateOnly(faker.date.soon(3));

      handler.setContextUser(memberParams.deviceId);
      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember();
      expect(generateDateOnly(new Date(member.dischargeDate))).toEqual(memberParams.dischargeDate);
    });

    /* eslint-disable max-len */
    test.each`
      input                             | error
      ${{ phone: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ deviceId: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ orgId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ primaryUserId: 123 }}         | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dateOfBirth: '2021/13/1' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ dischargeDate: '2021/13/1' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
      ${{ honorific: 'not-valid' }}     | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since setting $input is not a valid`,
      async (params) => {
        const primaryUserId = v4();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: generateId(),
          primaryUserId,
          usersIds: [primaryUserId],
          ...params.input,
        });

        await handler.mutations.createMember({ memberParams, ...params.error });
      },
    );

    test.each`
      input
      ${{ usersIds: [] }}
      ${{ usersIds: [123] }}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since setting $input is not a valid`,
      async (params) => {
        const primaryUserId = v4();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: generateId(),
          primaryUserId,
          usersIds: params.usersIds,
        });

        await handler.mutations.createMember({
          memberParams,
          missingFieldError: 'Field "usersIds" of required type "[String!]!" was not provided',
        });
      },
    );

    test.each`
      length           | errorString | field
      ${minLength - 1} | ${'short'}  | ${'firstName'}
      ${maxLength + 1} | ${'long'}   | ${'firstName'}
      ${minLength - 1} | ${'short'}  | ${'lastName'}
      ${maxLength + 1} | ${'long'}   | ${'lastName'}
    `(`should fail to create a member since $field is too $errorString`, async (params) => {
      const primaryUserId = v4();
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        primaryUserId,
        usersIds: [primaryUserId],
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
        const primaryUserId = v4();
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: generateId(),
          primaryUserId,
          usersIds: [primaryUserId],
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

    it('should throw error on primaryUserId not existing in users list', async () => {
      const primaryUserId = v4();
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: generateId(),
        primaryUserId,
        usersIds: [v4()],
      });
      await handler.mutations.createMember({
        memberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberPrimaryUserIdNotInUsers)],
      });
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
      input                | error
      ${{ userId: 123 }}   | ${stringError}
      ${{ memberId: 123 }} | ${stringError}
      ${{ peerId: 123 }}   | ${stringError}
      ${{ type: 123 }}     | ${'cannot represent non-string value'}
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
    `(`should fail to create a member since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const notifyParams: NotifyParams = generateNotifyParams();
      delete notifyParams[params.field];
      await handler.mutations.notify({ notifyParams, missingFieldError: params.error });
    });

    test.each([NotificationType.video, NotificationType.call])(
      'should throw error on peerId null when notificationType = %p',
      async (type) => {
        const notifyParams: NotifyParams = generateNotifyParams({ type });
        delete notifyParams.peerId;
        await handler.mutations.notify({
          notifyParams,
          invalidFieldsErrors: [Errors.get(ErrorType.notificationPeerIdIsMissing)],
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
      ${{ honorific: 'not-valid' }}     | ${{ missingFieldError: 'does not exist in "Honorific" enum' }}
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
