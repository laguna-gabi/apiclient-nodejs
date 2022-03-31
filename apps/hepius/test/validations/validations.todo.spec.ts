import { date } from 'faker';
import { ErrorType, Errors } from '../../src/common';
import {
  CreateActionTodoParams,
  CreateTodoDoneParams,
  CreateTodoParams,
  UpdateTodoParams,
} from '../../src/todo';
import { Handler } from '../aux/handler';
import {
  generateCreateActionTodoParams,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateGetTodoDonesParams,
  generateId,
  generateRequestHeaders,
  generateUpdateTodoParams,
} from '../index';

const stringError = `String cannot represent a non string value`;

describe('Validations - todo', () => {
  const handler: Handler = new Handler();

  beforeAll(async () => {
    await handler.beforeAll();
  }, 10000);

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

      await handler.mutations.createTodo({ createTodoParams, ...params.error });
    });

    it('should fail to create todo if text is empty string', async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        text: '',
      });

      await handler.mutations.createTodo({
        createTodoParams,
        missingFieldError: 'text should not be empty',
      });
    });

    it(`should fail to create a todo since start after end`, async () => {
      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: generateId(),
        end: new Date(),
        start: date.soon(2),
      });

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

      await handler.mutations.createTodo({
        createTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoUnscheduled)],
      });
    });
  });

  describe.only('createActionTodo', () => {
    test.each`
      field         | error
      ${'memberId'} | ${`Field "memberId" of required type "String!" was not provided.`}
      ${'label'}    | ${`Field "label" of required type "ActionTodoLabel!" was not provided.`}
    `(
      `should fail to create action todo since mandatory field $field is missing`,
      async (params) => {
        const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
          memberId: generateId(),
        });
        delete createActionTodoParams[params.field];
        await handler.mutations.createActionTodo({
          createActionTodoParams,
          missingFieldError: params.error,
        });
      },
    );

    it('should fail to create action todo since mandatory resource.id missing', async () => {
      const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId: generateId(),
      });
      delete createActionTodoParams.resource.id;
      await handler.mutations.createActionTodo({
        createActionTodoParams,
        missingFieldError: `Field "id" of required type "String!" was not provided.`,
      });
    });

    /* eslint-disable max-len */
    test.each`
      input                                                    | error
      ${{ memberId: 123 }}                                     | ${{ missingFieldError: stringError }}
      ${{ label: 'not-valid' }}                                | ${{ missingFieldError: 'does not exist in "ActionTodoLabel" enum.' }}
      ${{ resource: { id: 123 } }}                             | ${{ missingFieldError: stringError }}
      ${{ resource: { id: generateId(), name: 123 } }}         | ${{ missingFieldError: stringError }}
      ${{ resource: { id: generateId(), type: 'not-valid' } }} | ${{ missingFieldError: 'does not exist in "ResourceType" enum.' }}
    `(`should fail to create action todo since $input is not a valid`, async (params) => {
      /* eslint-enable max-len */
      const createActionTodoParams: CreateActionTodoParams = generateCreateActionTodoParams({
        memberId: generateId(),
        ...params.input,
      });

      await handler.mutations.createActionTodo({ createActionTodoParams, ...params.error });
    });
  });

  describe('getTodos', () => {
    it('should fail to get todos since memberId is not a valid', async () => {
      await handler.queries.getTodos({ memberId: 123, invalidFieldsError: stringError });
    });
  });

  describe('updateTodo', () => {
    /* eslint-disable max-len */
    test.each`
      field     | error
      ${'id'}   | ${`Field "id" of required type "String!" was not provided.`}
      ${'text'} | ${`Field "text" of required type "String!" was not provided.`}
    `(`should fail to update a todo since mandatory field $field is missing`, async (params) => {
      /* eslint-enable max-len */
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
      });
      delete updateTodoParams[params.field];
      await handler.mutations.updateTodo({
        updateTodoParams,
        missingFieldError: params.error,
      });
    });

    test.each`
      input                       | error
      ${{ id: 123 }}              | ${{ missingFieldError: stringError }}
      ${{ memberId: 123 }}        | ${{ missingFieldError: stringError }}
      ${{ text: 123 }}            | ${{ missingFieldError: stringError }}
      ${{ label: 'not-valid' }}   | ${{ missingFieldError: 'does not exist in "Label" enum.' }}
      ${{ cronExpressions: 123 }} | ${{ missingFieldError: stringError }}
    `(`should fail to update a todo since $input is not a valid`, async (params) => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        ...params.input,
      });

      await handler.mutations.updateTodo({ updateTodoParams, ...params.error });
    });

    it('should fail to update todo if text is empty string', async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        text: '',
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        missingFieldError: 'text should not be empty',
      });
    });

    it(`should fail to update a todo since start after end`, async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        end: new Date(),
        start: date.soon(2),
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoEndAfterStart)],
      });
    });

    it(`should fail to update a todo since end in the past`, async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        end: date.recent(1),
      });
      delete updateTodoParams.start;

      await handler.mutations.updateTodo({
        updateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoEndDateInThePast)],
      });
    });

    it(`should fail to update a todo since end in the past`, async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        start: date.recent(1),
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoStartDateInThePast)],
      });
    });

    it(`should fail to update a todo since cron array is empty`, async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        cronExpressions: [],
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        missingFieldError: 'cronExpressions should not be empty',
      });
    });

    it(`should fail to update a todo since invalid cron expression`, async () => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
        cronExpressions: ['not-valid'],
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoInvalidCronExpression)],
      });
    });

    test.each`
      input
      ${['cronExpressions']}
      ${['cronExpressions', 'start']}
      ${['cronExpressions', 'end']}
    `(`should fail to create unscheduled/scheduled todo since invalid params`, async (params) => {
      const updateTodoParams: UpdateTodoParams = generateUpdateTodoParams({
        memberId: generateId(),
      });
      params.input.forEach((element) => {
        delete updateTodoParams[element];
      });

      await handler.mutations.updateTodo({
        updateTodoParams,
        invalidFieldsErrors: [Errors.get(ErrorType.todoUnscheduledUpdate)],
      });
    });
  });

  describe('endTodo', () => {
    it('should fail to end a todo since id is not a valid', async () => {
      await handler.mutations.endTodo({
        id: 123,
        missingFieldError: stringError,
        requestHeaders: handler.defaultUserRequestHeaders,
      });
    });
  });

  describe('approveTodo', () => {
    it('should fail to approve Todo since id is not a valid', async () => {
      await handler.mutations.approveTodo({
        id: 123,
        missingFieldError: stringError,
        requestHeaders: handler.defaultUserRequestHeaders,
      });
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
        start: date.soon(2),
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
      await handler.mutations.deleteTodoDone({
        id: 123,
        missingFieldError: stringError,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });
    });
  });
});
