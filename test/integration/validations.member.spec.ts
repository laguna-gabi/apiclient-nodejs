import {
  generateCreateMemberParams,
  generateCreateTaskParams,
  generateCreateUserParams,
  generateOrgParams,
  generateRandomName,
  generateUpdateMemberParams,
  generateUpdateTaskStateParams,
} from '../index';
import * as config from 'config';
import * as faker from 'faker';
import { CreateMemberParams, defaultMemberParams, Sex, UpdateMemberParams } from '../../src/member';
import { Errors, ErrorType, Language } from '../../src/common';
import { Types } from 'mongoose';
import { Handler } from './aux/handler';

const validatorsConfig = config.get('graphql.validators');
const stringError = `String cannot represent a non string value`;

describe('Validations - member', () => {
  const handler: Handler = new Handler();

  const primaryCoachId = new Types.ObjectId().toString();
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
      field               | error
      ${'phoneNumber'}    | ${`Field "phoneNumber" of required type "String!" was not provided.`}
      ${'firstName'}      | ${`Field "firstName" of required type "String!" was not provided.`}
      ${'lastName'}       | ${`Field "lastName" of required type "String!" was not provided.`}
      ${'dateOfBirth'}    | ${`Field "dateOfBirth" of required type "DateTime!" was not provided.`}
      ${'primaryCoachId'} | ${`Field "primaryCoachId" of required type "String!" was not provided.`}
    `(`should fail to create a member since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId: new Types.ObjectId().toString(),
        primaryCoachId,
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
      ${'zipCode'}       | ${null}
      ${'dischargeDate'} | ${null}
    `(`should set default value if exists for optional field $field`, async (params) => {
      /* eslint-enable max-len */
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const { id: primaryCoachId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryCoachId,
      });
      delete memberParams[params.field];

      handler.setContextUser(memberParams.deviceId);
      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember();
      expect(member[params.field]).toEqual(params.defaultValue);
    });

    test.each`
      field         | value
      ${'sex'}      | ${Sex.female}
      ${'email'}    | ${faker.internet.email()}
      ${'language'} | ${Language.es}
      ${'zipCode'}  | ${faker.address.zipCode()}
    `(`should be able to set value for optional field $field`, async (params) => {
      const { id: orgId } = await handler.mutations.createOrg({ orgParams: generateOrgParams() });
      const { id: primaryCoachId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryCoachId,
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
      const { id: primaryCoachId } = await handler.mutations.createUser({
        userParams: generateCreateUserParams(),
      });
      const memberParams: CreateMemberParams = generateCreateMemberParams({
        orgId,
        primaryCoachId,
      });

      memberParams.dischargeDate = faker.date.future(1);

      handler.setContextUser(memberParams.deviceId);
      const { id } = await handler.mutations.createMember({ memberParams });
      expect(id).not.toBeUndefined();

      const member = await handler.queries.getMember();
      expect(new Date(member.dischargeDate)).toEqual(memberParams.dischargeDate);
    });

    /* eslint-disable max-len */
    test.each`
      input                             | error
      ${{ phoneNumber: 123 }}           | ${{ missingFieldError: stringError }}
      ${{ deviceId: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ firstName: 123 }}             | ${{ missingFieldError: stringError }}
      ${{ lastName: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ dateOfBirth: 'not-valid' }}   | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDateOfBirth)] }}
      ${{ orgId: 123 }}                 | ${{ missingFieldError: stringError }}
      ${{ primaryCoachId: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ usersIds: [123] }}            | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since setting $input is not a valid`,
      async (params) => {
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: new Types.ObjectId().toString(),
          primaryCoachId,
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
        primaryCoachId,
        orgId: new Types.ObjectId().toString(),
      });
      memberParams[params.field] = generateRandomName(params.length);
      await handler.mutations.createMember({
        memberParams,
        invalidFieldsErrors: [Errors.get(ErrorType.memberMinMaxLength)],
      });
    });

    /* eslint-disable max-len */
    test.each`
      field            | input                                                  | errors
      ${'phoneNumber'} | ${{ primaryCoachId, phoneNumber: '+410' }}             | ${[Errors.get(ErrorType.memberPhoneNumber)]}
      ${'dateOfBirth'} | ${{ primaryCoachId, dateOfBirth: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDateOfBirth)]}
    `(
      /* eslint-enable max-len */
      `should fail to create a member since $field is not valid`,
      async (params) => {
        const memberParams: CreateMemberParams = generateCreateMemberParams({
          orgId: new Types.ObjectId().toString(),
          primaryCoachId,
          ...params.input,
        });
        await handler.mutations.createMember({
          memberParams,
          invalidFieldsErrors: params.errors,
        });
      },
    );

    it('should throw error on non existing member', async () => {
      handler.setContextUser('not-valid');
      await handler.queries.getMember({
        invalidFieldsError: Errors.get(ErrorType.memberNotFound),
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
      ${{ readmissionRisk: 123 }}       | ${{ missingFieldError: stringError }}
      ${{ phoneSecondary: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ email: 'not-valid' }}         | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberEmailFormat)] }}
      ${{ sex: 'not-valid' }}           | ${{ missingFieldError: 'does not exist in "Sex" enum' }}
      ${{ language: 'not-valid' }}      | ${{ missingFieldError: 'does not exist in "Language" enum' }}
      ${{ zipCode: 123 }}               | ${{ missingFieldError: stringError }}
      ${{ dischargeDate: 'not-valid' }} | ${{ invalidFieldsErrors: [Errors.get(ErrorType.memberDischargeDate)] }}
    `(`should fail to update a member since setting $input is not a valid`, async (params) => {
      /* eslint-enable max-len */
      const updateMemberParams = generateUpdateMemberParams({ ...params.input });

      await handler.mutations.updateMember({ updateMemberParams, ...params.error });
    });

    /* eslint-disable max-len */
    test.each`
      field               | input                                    | errors
      ${'phoneSecondary'} | ${{ phoneSecondary: '+410' }}            | ${[Errors.get(ErrorType.memberPhoneNumber)]}
      ${'dischargeDate'}  | ${{ dischargeDate: faker.lorem.word() }} | ${[Errors.get(ErrorType.memberDischargeDate)]}
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

    describe('updateGoalState + updateActionItemState', () => {
      /* eslint-disable max-len */
      test.each`
        field      | taskType               | error
        ${'id'}    | ${TaskType.goal}       | ${`Field "id" of required type "String!" was not provided.`}
        ${'state'} | ${TaskType.goal}       | ${`Field "state" of required type "TaskState!" was not provided.`}
        ${'id'}    | ${TaskType.actionItem} | ${`Field "id" of required type "String!" was not provided.`}
        ${'state'} | ${TaskType.actionItem} | ${`Field "state" of required type "TaskState!" was not provided.`}
      `(
        /* eslint-enable max-len */
        `should fail to update $taskType since mandatory field $field is missing`,
        async (params) => {
          const updateTaskStateParams = generateUpdateTaskStateParams();
          delete updateTaskStateParams[params.field];
          const method = TaskType.goal
            ? handler.mutations.updateGoalState
            : handler.mutations.updateActionItemState;
          await method({
            updateTaskStateParams,
            missingFieldError: params.error,
          });
        },
      );

      /* eslint-disable max-len */
      test.each`
        input             | taskType               | error
        ${{ id: 123 }}    | ${TaskType.goal}       | ${stringError}
        ${{ state: 123 }} | ${TaskType.goal}       | ${'Enum "TaskState" cannot represent non-string value'}
        ${{ id: 123 }}    | ${TaskType.actionItem} | ${stringError}
        ${{ state: 123 }} | ${TaskType.actionItem} | ${'Enum "TaskState" cannot represent non-string value'}
      `(`should fail to update $taskType since $input is not a valid type`, async (params) => {
        /* eslint-enable max-len */
        const updateTaskStateParams = generateUpdateTaskStateParams({ ...params.input });
        const method = TaskType.goal
          ? handler.mutations.updateGoalState
          : handler.mutations.updateActionItemState;
        await method({
          updateTaskStateParams,
          missingFieldError: params.error,
        });
      });
    });
  });
});
