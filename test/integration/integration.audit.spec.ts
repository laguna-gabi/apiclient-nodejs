import { addDays } from 'date-fns';
import { lorem } from 'faker';
import { buildNPSQuestionnaire } from '../../cmd/statics';
import { ActionItem, ActionItemDocument, CaregiverDocument, TaskStatus } from '../../src/member';
import { QuestionnaireResponseDocument } from '../../src/questionnaire';
import {
  CreateTodoDoneParams,
  CreateTodoParams,
  EndAndCreateTodoParams,
  TodoDocument,
  TodoDoneDocument,
} from '../../src/todo';
import { User } from '../../src/user';
import { Handler } from '../aux';
import {
  checkAuditValues,
  generateAddCaregiverParams,
  generateCreateTodoDoneParams,
  generateCreateTodoParams,
  generateCreateUserParams,
  generateEndAndCreateTodoParams,
  generateRequestHeaders,
  generateUpdateCaregiverParams,
} from '../index';

describe('Integration tests : Audit', () => {
  const handler: Handler = new Handler();
  let user1: Partial<User>;
  let user2: Partial<User>;

  beforeAll(async () => {
    await handler.beforeAll();

    const userParams = [generateCreateUserParams(), generateCreateUserParams()];
    const [{ id: userId1 }, { id: userId2 }] = await Promise.all(
      userParams.map((userParams) => handler.mutations.createUser({ userParams })),
    );
    user1 = { id: userId1, ...userParams[0] };
    user2 = { id: userId2, ...userParams[1] };
  }, 10000);

  afterAll(async () => {
    await handler.afterAll();
  });

  describe('Caregiver', () => {
    it('should update createdAt and updatedAt fields', async () => {
      /**
       * 1. Add Caregiver for PatientZero and by PatientZero
       * 2. Update Caregiver for PatientZero and by PatientZero's primary user
       *
       * Note: confirm `save` and `findOneAndUpdate` hooks
       */

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

  describe('Todo', () => {
    it('should update createdAt and updatedAt fields', async () => {
      /**
       * 1. User creates a todo for member
       * 1.1 confirm `createdAt` === `updatedAt` === User.id for Todo
       * 2. Member end and create todo
       * 2.1 confirm `createdAt` === User.id && `updatedAt` === Member.id for Todo
       * 3. create TodoDone (by member)
       * 3.1 confirm `createdAt` === `updatedAt` === Member.id for TodoDone
       *
       * Note: confirm `updateOne` (used by the `endAndCreateTodo` service method)
       */

      // Get primary user authId and id for token in request header and validation
      const { id: userId, authId: userAuthId } = await handler.userService.get(
        handler.patientZero.primaryUserId.toString(),
      );

      const createTodoParams: CreateTodoParams = generateCreateTodoParams({
        memberId: handler.patientZero.id.toString(),
      });

      const { id } = await handler.mutations.createTodo({
        requestHeaders: generateRequestHeaders(userAuthId),
        createTodoParams,
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<TodoDocument>(id, handler.todoModel, userId, userId),
      ).toBeTruthy();

      const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({ id });
      const { id: newCreatedTodoId } = await handler.mutations.endAndCreateTodo({
        endAndCreateTodoParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
      expect(
        await checkAuditValues<TodoDocument>(
          newCreatedTodoId,
          handler.todoModel,
          userId,
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();

      const createTodoDoneParams: CreateTodoDoneParams = generateCreateTodoDoneParams({
        todoId: newCreatedTodoId,
      });

      delete createTodoDoneParams.memberId;

      const { id: todoDoneId } = await handler.mutations.createTodoDone({
        createTodoDoneParams: createTodoDoneParams,
        requestHeaders: generateRequestHeaders(handler.patientZero.authId),
      });

      expect(
        await checkAuditValues<TodoDoneDocument>(
          todoDoneId,
          handler.todoDoneModel,
          handler.patientZero.id.toString(),
          handler.patientZero.id.toString(),
        ),
      ).toBeTruthy();
    });

    it('[stress] should update createdAt and updatedAt fields', async () => {
      /**
       * 0. pick a random user (out of 5 users) - user1
       * 1. user1 creates a todo for member
       * 1.1 confirm `createdAt` === `updatedAt` === user1.id for Todo
       * 2. pick a random user (out of 5 users) - user2
       * 2. user2 end and create todo for patient zero
       * 3.1 confirm newly created todo - `createdAt` === user1.id && `updatedAt` === user2 for Todo
       */

      // create 5 users:
      const users = [];

      for (let i = 0; i < 5; i++) {
        const { id } = await handler.mutations.createUser({
          userParams: generateCreateUserParams(),
        });
        users.push(await handler.userService.get(id));
      }

      // run 100 tests to create and update todo's
      const tests = [];
      for (let i = 0; i < 100; i++) {
        tests.push(testRunner(users, handler));
      }

      await Promise.all(tests);
    });
  });

  describe(ActionItem.name, () => {
    it('should update createdBy and updatedBy fields for action item api', async () => {
      const { id } = await handler.mutations.createActionItem({
        createTaskParams: {
          memberId: handler.patientZero.id,
          title: lorem.sentence(),
          deadline: addDays(new Date(), 1),
        },
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<ActionItemDocument>(id, handler.actionItemModel, user1.id, user1.id),
      ).toBeTruthy();

      await handler.mutations.updateActionItemStatus({
        updateTaskStatusParams: { id, status: TaskStatus.reached },
        requestHeaders: generateRequestHeaders(user2.authId),
      });

      expect(
        await checkAuditValues<ActionItemDocument>(id, handler.actionItemModel, user1.id, user2.id),
      ).toBeTruthy();
    });
  });

  describe('Questionnaire', () => {
    it('should create a questionnaire response with createdBy and updatedBy', async () => {
      const { id: questionnaireId } = await handler.mutations.createQuestionnaire({
        createQuestionnaireParams: buildNPSQuestionnaire(),
      });

      const { id } = await handler.mutations.submitQuestionnaireResponse({
        submitQuestionnaireResponseParams: {
          questionnaireId,
          memberId: handler.patientZero.id,
          answers: [{ code: 'q1', value: '1' }],
        },
        requestHeaders: generateRequestHeaders(user1.authId),
      });

      expect(
        await checkAuditValues<QuestionnaireResponseDocument>(
          id,
          handler.questionnaireResponseModel,
          user1.id,
          user1.id,
        ),
      ).toBeTruthy();
    });
  });
});

/**************************************************************************************************
 **************************************** Service methods *****************************************
 *************************************************************************************************/

async function testRunner(users: User[], handler: Handler) {
  const user1 = getRandomUser(users);
  const createTodoParams: CreateTodoParams = generateCreateTodoParams({
    memberId: handler.patientZero.id,
  });

  const { id } = await handler.mutations.createTodo({
    requestHeaders: generateRequestHeaders(user1.authId),
    createTodoParams,
  });

  // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
  expect(
    await checkAuditValues<TodoDocument>(
      id,
      handler.todoModel,
      user1.id.toString(),
      user1.id.toString(),
    ),
  ).toBeTruthy();

  const user2 = getRandomUser(users);
  const endAndCreateTodoParams: EndAndCreateTodoParams = generateEndAndCreateTodoParams({
    memberId: handler.patientZero.id,
    id,
  });
  const { id: newCreatedTodoId } = await handler.mutations.endAndCreateTodo({
    endAndCreateTodoParams,
    requestHeaders: generateRequestHeaders(user2.authId),
  });

  // confirm that `createdBy` and `updatedBy` are set correctly (only `updatedBy` should change)
  expect(
    await checkAuditValues<TodoDocument>(
      newCreatedTodoId,
      handler.todoModel,
      user1.id.toString(),
      user2.id.toString(),
    ),
  ).toBeTruthy();
}

function getRandomUser(users: User[]): User {
  return users[Math.floor(Math.random() * users.length)];
}
