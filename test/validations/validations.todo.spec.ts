import * as faker from 'faker';
import { ErrorType, Errors, UserRole } from '../../src/common';
import { CreateTodoDoneParams, CreateTodoParams, EndAndCreateTodoParams } from '../../src/todo';
import { Handler } from '../aux/handler';
import {
  generateCreateTodoDoneParams,
  generateEndAndCreateTodoParams,
  generateGetTodoDonesParams,
  generateId,
} from '../generators';
import { generateCreateTodoParams, generateCreateUserParams } from '../index';

const stringError = `String cannot represent a non string value`;

describe('Validations - todo', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
    const { id } = await handler.mutations.createUser({ userParams: generateCreateUserParams() });
    handler.setContextUserId(id, '', [UserRole.coach]);
  });

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('createTodo', () => {
    /* eslint-disable max-len */
    test.each`
      field     | error
      ${'text'} | ${`Field "text" of required type "String!" was not provided.`}
    `(`should fail to create a todo since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
      });
      delete createTodoParams[params.field];
      await handler.mutations.createTodo({ createTodoParams, missingFieldError: params.error });
    });

    test.each`
      input                       | error
      ${{ memberId: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ text: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ label: 'not-valid' }}   | ${{ missingFieldError: 'does not exist in "Label" enum.' }}
      ${{ cronExpressions: 123 }} | ${{ missingFieldError: stringError }}
    `(`should fail to create a todo since $input is not a valid`, async (params) => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        ...params.input,
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({ createTodoParams, ...params.error });
    });

    it('should fail to create todo if text is empty string', async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        text: '',
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({
        createTodoParams,
        missingFieldError: 'text should not be empty',
      });
    });

    it(`should fail to create a todo since start after end`, async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        end: new Date(),
        start: faker.date.soon(2),
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({
        createTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoEndAfterStart)],
      });
    });

    it(`should fail to create a todo since cron array is empty`, async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        cronExpressions: [],
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({
        createTodoParams,
        missingFieldError: 'cronExpressions should not be empty',
      });
    });

    it(`should fail to create a todo since invalid cron expression`, async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        cronExpressions: ['not-valid'],
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({
        createTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoInvalidCronExpression)],
      });
    });

    test.each`
      input
      ${['start']}
      ${['cronExpressions']}
      ${['start', 'cronExpressions']}
      ${['cronExpressions', 'end']}
      ${['start', 'end']}
    `(`should fail to create unscheduled/scheduled todo since invalid params`, async (params) => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
      });
      params.input.forEach((element) => {
        delete createTodoParams[element];
      });
      delete createTodoParams.createdBy;
      delete createTodoParams.updatedBy;

      await handler.mutations.createTodo({
        createTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoUnscheduled)],
      });
    });
  });

  describe('getTodos', () => {
    it('should fail to get todos since memberId is not a valid', async () => {
      await handler.queries.getTodos({ memberId: 123, invalidFieldsError: stringError });
    });
  });

  describe('endAndCreateTodo', () => {
    /* eslint-disable max-len */
    test.each`
      field     | error
      ${'id'}   | ${`Field "id" of required type "String!" was not provided.`}
      ${'text'} | ${`Field "text" of required type "String!" was not provided.`}
    `(
      `should fail to endAndCreate a todo since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
          memberId: generateId(),
        });
        delete endAndCreateTodoParams[params.field];
        await handler.mutations.endAndCreateTodo({
          endAndCreateTodoParams,
          missingFieldError: params.error,
        });
      },
    );

    test.each`
      input                       | error
      ${{ id: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ memberId: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ text: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ label: 'not-valid' }}   | ${{ missingFieldError: 'does not exist in "Label" enum.' }}
      ${{ cronExpressions: 123 }} | ${{ missingFieldError: stringError }}
    `(`should fail to endAndCreate a todo since $input is not a valid`, async (params) => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
        ...params.input,
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({ endAndCreateTodoParams, ...params.error });
    });

    it('should fail to endAndCreate todo if text is empty string', async () => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
        text: '',
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        missingFieldError: 'text should not be empty',
      });
    });

    it(`should fail to endAndCreate a todo since start after end`, async () => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
        end: new Date(),
        start: faker.date.soon(2),
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoEndAfterStart)],
      });
    });

    it(`should fail to endAndCreate a todo since cron array is empty`, async () => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
        cronExpressions: [],
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        missingFieldError: 'cronExpressions should not be empty',
      });
    });

    it(`should fail to endAndCreate a todo since invalid cron expression`, async () => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
        cronExpressions: ['not-valid'],
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoInvalidCronExpression)],
      });
    });

    test.each`
      input
      ${['start']}
      ${['cronExpressions']}
      ${['start', 'cronExpressions']}
      ${['cronExpressions', 'end']}
      ${['start', 'end']}
    `(`should fail to create unscheduled/scheduled todo since invalid params`, async (params) => {
      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
        memberId: generateId(),
      });
      params.input.forEach((element) => {
        delete endAndCreateTodoParams[element];
      });
      delete endAndCreateTodoParams.updatedBy;

      await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoUnscheduled)],
      });
    });
  });

  describe('endTodo', () => {
    it('should fail to end a todo since id is not a valid', async () => {
      await handler.mutations.endTodo({ id: 123, missingFieldError: stringError });
    });
  });

  describe('approveTodo', () => {
    it('should fail to approve Todo since id is not a valid', async () => {
      await handler.mutations.approveTodo({ id: 123, missingFieldError: stringError });
    });
  });

  describe('createTodoDone', () => {
    /* eslint-disable max-len */
    test.each`
      field       | error
      ${'todoId'} | ${`Field "todoId" of required type "String!" was not provided.`}
      ${'done'}   | ${`Field "done" of required type "DateTime!" was not provided.`}
    `(
      `should fail to create a todoDone since mandatory field $field is missing`,
      async (params) => {
        /* eslint-enable max-len */
        const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams();
        delete createTodoDoneParams[params.field];

        await handler.mutations.createTodoDone({
          createTodoDoneParams,
          missingFieldError: params.error,
        });
      },
    );

    it('should fail to create a todoDone since todoId is not valid', async () => {
      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        todoId: 123,
      });
      delete createTodoDoneParams.memberId;

      await handler.mutations.createTodoDone({
        createTodoDoneParams,
        missingFieldError: stringError,
      });
    });
  });

  describe('getTodoDones', () => {
    test.each`
      field      | error
      ${'start'} | ${`Field "start" of required type "DateTime!" was not provided.`}
      ${'end'}   | ${`Field "end" of required type "DateTime!" was not provided.`}
    `(`should fail to get todoDones since mandatory field $field is missing`, async (params) => {
      const getTodoDonesParams = generateGetTodoDonesParams({ memberId: generateId() });
      delete getTodoDonesParams[params.field];

      await handler.queries.getTodoDones({
        getTodoDonesParams,
        invalidFieldsError: params.error,
      });
    });

    it(`should fail to get todoDones since start after end`, async () => {
      const getTodoDonesParams = generateGetTodoDonesParams({
        memberId: generateId(),
        start: faker.date.soon(2),
        end: new Date(),
      });

      await handler.queries.getTodoDones({
        getTodoDonesParams,
        invalidFieldsError: Errors.get(ErrorType.todoEndAfterStart),
      });
    });
  });

  describe('deleteTodoDone', () => {
    it('should fail to delete TodoDone since id is not a valid', async () => {
      await handler.mutations.deleteTodoDone({ id: 123, missingFieldError: stringError });
    });
  });
});
